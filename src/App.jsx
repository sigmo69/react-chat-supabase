import { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [user, setUser] = useState(null)
  const [currentRoom, setCurrentRoom] = useState('general')
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState('chat')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [login, setLogin] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [newNickname, setNewNickname] = useState('')
  const messagesEndRef = useRef(null)
  
  // Звук сповіщення
  const [audio] = useState(new Audio('/notify.mp3'))

  useEffect(() => {
    // Запит дозволу на браузерні сповіщення
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) setNewNickname(currentUser.user_metadata?.display_name || '')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) setNewNickname(currentUser.user_metadata?.display_name || '')
    })

    return () => subscription.unsubscribe()
  }, [])

  const startPrivateChat = (targetLogin) => {
    const myLogin = user.user_metadata?.display_name || user.email;
    const roomId = [myLogin, targetLogin].sort().join('_');
    setCurrentRoom(roomId);
    setSearchQuery('');
    setView('chat');
  }

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', currentRoom)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  // РЕАЛЬНИЙ ЧАС ТА СПОВІЩЕННЯ
  useEffect(() => {
    if (!user || view !== 'chat') return

    fetchMessages()

    // Підписка на нові повідомлення
    const channel = supabase
      .channel(`room-${currentRoom}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${currentRoom}` }, 
        (payload) => {
          const incoming = payload.new
          const myName = user.user_metadata?.display_name || user.email

          // Якщо пише хтось інший
          if (incoming.username !== myName) {
            audio.play().catch(() => {}) // Граємо звук
            
            if (Notification.permission === "granted") {
              new Notification(`Нове від ${incoming.username}`, {
                body: incoming.messages,
              })
            }
          }
          
          setMessages((prev) => [...prev, incoming])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, currentRoom, view])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleAuth = async (e) => {
    e.preventDefault()
    if (isRegistering) {
      const { error } = await supabase.auth.signUp({ 
        email, password, 
        options: { data: { display_name: login } } 
      })
      if (error) alert(error.message)
      else alert('Успіх! Тепер увійдіть.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) alert(error.message)
    }
  }

  const updateProfile = async (e) => {
    e.preventDefault()
    const { error } = await supabase.auth.updateUser({
      data: { display_name: newNickname }
    })
    if (error) alert(error.message)
    else {
      alert('Нікнейм оновлено!')
      setView('chat')
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    const displayName = user.user_metadata?.display_name || user.email
    
    const { error } = await supabase.from('messages').insert([{ 
      messages: newMessage, 
      username: displayName,
      room_id: currentRoom 
    }])

    if (!error) setNewMessage('')
  }

  if (!user) {
    return (
      <div style={styles.container}>
        <form onSubmit={handleAuth} style={styles.loginBox}>
          <h3>{isRegistering ? 'Реєстрація' : 'Вхід'}</h3>
          {isRegistering && <input style={styles.input} placeholder="Придумайте логін" value={login} onChange={e => setLogin(e.target.value)} required />}
          <input style={styles.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={styles.input} type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" style={styles.button}>{isRegistering ? 'Створити' : 'Увійти'}</button>
          <p onClick={() => setIsRegistering(!isRegistering)} style={styles.toggleText}>
            {isRegistering ? 'Вже є акаунт? Увійти' : 'Немає акаунта? Реєстрація'}
          </p>
        </form>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <input 
            style={styles.searchInput} 
            placeholder="Пошук друга..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <div style={styles.searchResults}>
              <div onClick={() => startPrivateChat(searchQuery)} style={styles.userItem}>
                💬 Написати: {searchQuery}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div 
            onClick={() => { setCurrentRoom('general'); setView('chat'); }} 
            style={{...styles.roomItem, background: currentRoom === 'general' && view === 'chat' ? '#eefaff' : 'transparent'}}
          >
            # Загальний чат
          </div>
        </div>

        <div style={styles.sidebarFooter}>
          <div onClick={() => setView('profile')} style={styles.profileSummary}>
            👤 <span>{user.user_metadata?.display_name || 'Профіль'}</span>
          </div>
          <button onClick={() => supabase.auth.signOut()} style={styles.logoutBtnSmall}>Вийти</button>
        </div>
      </div>

      <div style={styles.chatWindow}>
        {view === 'chat' ? (
          <>
            <div style={styles.header}>
              <span>Чат: <b>{currentRoom === 'general' ? 'Загальний' : `Діалог: ${currentRoom}`}</b></span>
            </div>
            <div style={styles.messagesList}>
              {messages.map(msg => (
                <div key={msg.id} style={{
                  ...styles.messageBubble,
                  alignSelf: msg.username === (user.user_metadata?.display_name || user.email) ? 'flex-end' : 'flex-start',
                  background: msg.username === (user.user_metadata?.display_name || user.email) ? '#3fcf8e' : '#0084ff',
                  borderRadius: msg.username === (user.user_metadata?.display_name || user.email) ? '15px 15px 2px 15px' : '15px 15px 15px 2px'
                }}>
                  <div style={{fontSize: '10px', opacity: 0.8, marginBottom: '3px'}}>{msg.username}</div>
                  <div>{msg.messages}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} style={styles.inputArea}>
              <input style={styles.input} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Напишіть повідомлення..." />
              <button type="submit" style={styles.button}>OK</button>
            </form>
          </>
        ) : (
          <div style={styles.profileContainer}>
            <h3>Налаштування профілю</h3>
            <p style={{fontSize: '12px', color: '#666', marginBottom: '20px'}}>{user.email}</p>
            <div style={{width: '100%', maxWidth: '300px'}}>
              <label style={{fontSize: '12px', fontWeight: 'bold'}}>Ваш нікнейм:</label>
              <input 
                style={{...styles.input, width: '100%', marginTop: '5px', textAlign: 'center'}} 
                value={newNickname} 
                onChange={e => setNewNickname(e.target.value)} 
              />
            </div>
            <div style={{display: 'flex', gap: '10px', marginTop: '30px'}}>
              <button onClick={() => setView('chat')} style={{...styles.button, background: '#ccc'}}>Назад</button>
              <button onClick={updateProfile} style={styles.button}>Зберегти</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: { background: '#f0f2f5', height: '100vh', display: 'flex', fontFamily: 'sans-serif' },
  sidebar: { width: '260px', background: 'white', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' },
  sidebarHeader: { padding: '15px', borderBottom: '1px solid #eee' },
  searchInput: { width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #ddd', outline: 'none', boxSizing: 'border-box' },
  searchResults: { background: '#f9f9f9', padding: '5px', borderRadius: '5px', marginTop: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' },
  userItem: { padding: '10px', cursor: 'pointer', borderRadius: '5px', fontSize: '14px', background: '#eefaff', color: '#0084ff' },
  roomItem: { padding: '15px', cursor: 'pointer', fontWeight: 'bold', borderBottom: '1px solid #f9f9f9' },
  sidebarFooter: { padding: '15px', borderTop: '1px solid #eee', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  profileSummary: { cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '5px', color: '#333' },
  chatWindow: { flex: 1, display: 'flex', flexDirection: 'column', background: 'white' },
  header: { padding: '15px 20px', background: 'white', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  messagesList: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f9f9f9' },
  messageBubble: { color: 'white', padding: '10px 14px', maxWidth: '75%', wordWrap: 'break-word' },
  inputArea: { padding: '15px 20px', background: 'white', display: 'flex', gap: '10px', borderTop: '1px solid #eee' },
  input: { flex: 1, padding: '12px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none' },
  button: { background: '#3fcf8e', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold' },
  loginBox: { margin: 'auto', background: 'white', padding: '40px', borderRadius: '20px', textAlign: 'center', width: '320px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' },
  logoutBtnSmall: { color: '#ff4d4d', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  toggleText: { cursor: 'pointer', fontSize: '12px', marginTop: '15px', color: '#0084ff', textDecoration: 'underline' },
  profileContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }
}

export default App;