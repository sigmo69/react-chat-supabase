import { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'

function App() {
  // --- ДАНІ ТА СТАН ---
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [user, setUser] = useState(null)
  const [currentRoom, setCurrentRoom] = useState('general')
  const [groups, setGroups] = useState(['general'])
  
  // --- UI СТАН ---
  const [view, setView] = useState('chat') 
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [groupNameInput, setGroupNameInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  
  // --- ПОЛЯ ФОРМ ---
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [login, setLogin] = useState('')
  const [newNickname, setNewNickname] = useState('')

  const messagesEndRef = useRef(null)
  const audioRef = useRef(null)

  // --- 1. ІНІЦІАЛІЗАЦІЯ ---
  useEffect(() => {
    audioRef.current = new Audio('/notify.mp3')

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

  // --- 2. ЛОГІКА ПОВІДОМЛЕНЬ ---
  const fetchMessages = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', currentRoom)
      .order('created_at', { ascending: true })
    
    if (!error && data) setMessages(data)
  }

  useEffect(() => {
    if (!user || view !== 'chat') return

    fetchMessages()
    const interval = setInterval(fetchMessages, 3000)

    const channel = supabase
      .channel(`room-${currentRoom}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${currentRoom}` }, 
        (payload) => {
          const incoming = payload.new
          const myName = user.user_metadata?.display_name || user.email
          if (incoming.username !== myName) {
            audioRef.current?.play().catch(() => {})
          }
          setMessages((prev) => prev.find(m => m.id === incoming.id) ? prev : [...prev, incoming])
        }
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [user, currentRoom, view])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // --- 3. ФУНКЦІЇ ---
  const handleAuth = async (e) => {
    e.preventDefault()
    if (isRegistering) {
      const { error } = await supabase.auth.signUp({ 
        email, password, options: { data: { display_name: login } } 
      })
      if (error) alert(error.message)
      else alert('Реєстрація успішна! Тепер увійдіть.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) alert(error.message)
    }
  }

  const updateProfile = async () => {
    const { error } = await supabase.auth.updateUser({
      data: { display_name: newNickname }
    })
    if (error) alert(error.message)
    else {
      alert('Дані оновлено!')
      setView('chat')
    }
  }

  const createGroup = () => {
    const name = groupNameInput.trim().toLowerCase()
    if (name && !groups.includes(name)) {
      setGroups(prev => [...prev, name])
      setCurrentRoom(name)
      setGroupNameInput('')
      setIsCreatingGroup(false)
    }
  }

  const startPrivateChat = (targetLogin) => {
    const myLogin = user.user_metadata?.display_name || user.email
    const roomId = [myLogin, targetLogin].sort().join('_')
    if (!groups.includes(roomId)) setGroups(prev => [...prev, roomId])
    setCurrentRoom(roomId)
    setSearchQuery('')
    setView('chat')
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    const name = user.user_metadata?.display_name || user.email
    await supabase.from('messages').insert([{ 
      messages: newMessage, 
      username: name, 
      room_id: currentRoom 
    }])
    setNewMessage('')
    fetchMessages()
  }

  // --- РЕНДЕР: ВХІД ---
  if (!user) {
    return (
      <div style={styles.container}>
        <form onSubmit={handleAuth} style={styles.loginBox}>
          <h2 style={{ color: '#3fcf8e', marginBottom: '20px' }}>
            {isRegistering ? 'Створити акаунт' : 'Вхід у чат'}
          </h2>
          
          {isRegistering && (
            <input 
              style={styles.input} 
              placeholder="Придумайте логін (нікнейм)" 
              value={login} 
              onChange={e => setLogin(e.target.value)} 
              required 
            />
          )}
          
          <input 
            style={styles.input} 
            type="email" 
            placeholder="Ваш Email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required 
          />
          
          <input 
            style={styles.input} 
            type="password" 
            placeholder="Пароль" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
          />
          
          <button type="submit" style={styles.button}>
            {isRegistering ? 'Зареєструватися' : 'Увійти'}
          </button>
          
          <p 
            onClick={() => setIsRegistering(!isRegistering)} 
            style={styles.toggleText}
          >
            {isRegistering ? 'Вже є акаунт? Увійти' : 'Немає акаунта? Зареєструватися'}
          </p>
        </form>
      </div>
    )
  }

  // --- РЕНДЕР: ДОДАТОК ---
  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
            <b style={{fontSize: '18px'}}>Чати</b>
            <button 
              onClick={() => setIsCreatingGroup(!isCreatingGroup)} 
              style={styles.addGroupBtn}
            >
              +
            </button>
          </div>
          
          {isCreatingGroup && (
            <div style={{display: 'flex', gap: '5px', marginBottom: '10px'}}>
              <input style={{...styles.input, padding: '8px'}} placeholder="Назва групи" value={groupNameInput} onChange={e => setGroupNameInput(e.target.value)} />
              <button onClick={createGroup} style={{...styles.button, padding: '5px 10px'}}>OK</button>
            </div>
          )}

          <input 
            style={styles.searchInput} 
            placeholder="Знайти друга..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <div style={styles.searchResults} onClick={() => startPrivateChat(searchQuery)}>
              👤 Почати чат з <b>{searchQuery}</b>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {groups.map(g => (
            <div 
              key={g} 
              onClick={() => { setCurrentRoom(g); setView('chat'); }} 
              style={{...styles.roomItem, background: currentRoom === g && view === 'chat' ? '#eefaff' : 'transparent'}}
            >
              {g.includes('_') ? `👤 ${g.replace(user.user_metadata?.display_name || '', '').replace('_', '')}` : `# ${g}`}
            </div>
          ))}
        </div>

        <div style={styles.sidebarFooter}>
          <div onClick={() => setView('profile')} style={{cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'}}>
            <span>⚙️</span>
            <span style={{fontWeight: 'bold'}}>{user.user_metadata?.display_name || 'Профіль'}</span>
          </div>
          <button onClick={() => supabase.auth.signOut()} style={styles.logoutBtnSmall}>Вийти</button>
        </div>
      </div>

      <div style={styles.chatWindow}>
        {view === 'chat' ? (
          <>
            <div style={styles.header}>
              <span>{currentRoom.includes('_') ? 'Приватна бесіда' : `Група: #${currentRoom}`}</span>
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
              <input style={styles.input} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Напишіть щось..." />
              <button type="submit" style={styles.button}>OK</button>
            </form>
          </>
        ) : (
          <div style={styles.profileContainer}>
            <h3>Мій профіль</h3>
            <div style={{width: '100%', maxWidth: '300px', marginTop: '20px'}}>
              <label style={{fontSize: '12px', fontWeight: 'bold'}}>Змінити нікнейм:</label>
              <input style={{...styles.input, width: '100%', marginTop: '10px', textAlign: 'center'}} value={newNickname} onChange={e => setNewNickname(e.target.value)} />
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

// --- СТИЛІ ---
const styles = {
  container: { background: '#f0f2f5', height: '100vh', display: 'flex', fontFamily: 'sans-serif' },
  sidebar: { width: '280px', background: 'white', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' },
  sidebarHeader: { padding: '20px', borderBottom: '1px solid #eee' },
  // Оновлена кнопка з ідеальним центруванням плюсика:
  addGroupBtn: { 
    background: '#3fcf8e', 
    color: 'white', 
    border: 'none', 
    borderRadius: '50%', 
    width: '32px', 
    height: '32px', 
    cursor: 'pointer', 
    fontSize: '22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '0',
    paddingBottom: '4px', // Ювелірне центрування символу "+"
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
  },
  searchInput: { width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #ddd', outline: 'none', boxSizing: 'border-box' },
  searchResults: { background: '#eefaff', padding: '10px', borderRadius: '8px', marginTop: '10px', cursor: 'pointer', color: '#0084ff' },
  roomItem: { padding: '15px 20px', cursor: 'pointer', fontWeight: '500', borderBottom: '1px solid #f9f9f9' },
  sidebarFooter: { padding: '15px 20px', borderTop: '1px solid #eee', background: '#fafafa', display: 'flex', justifyContent: 'space-between' },
  chatWindow: { flex: 1, display: 'flex', flexDirection: 'column', background: 'white' },
  header: { padding: '18px 25px', background: 'white', borderBottom: '1px solid #eee', fontWeight: 'bold' },
  messagesList: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f9f9f9' },
  messageBubble: { color: 'white', padding: '10px 15px', maxWidth: '75%' },
  inputArea: { padding: '20px', display: 'flex', gap: '10px', borderTop: '1px solid #eee' },
  input: { flex: 1, padding: '12px 18px', borderRadius: '25px', border: '1px solid #ddd', outline: 'none' },
  button: { background: '#3fcf8e', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold' },
  loginBox: { margin: 'auto', background: 'white', padding: '40px', borderRadius: '25px', textAlign: 'center', width: '320px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' },
  logoutBtnSmall: { color: '#ff4d4d', border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px' },
  toggleText: { cursor: 'pointer', fontSize: '13px', marginTop: '15px', color: '#0084ff', textDecoration: 'underline' },
  profileContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
}

export default App;