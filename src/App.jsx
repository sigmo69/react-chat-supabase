import { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [user, setUser] = useState(null)
  const [currentRoom, setCurrentRoom] = useState('general')
  const [groups, setGroups] = useState(['general']) // Список груп
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [groupNameInput, setGroupNameInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [view, setView] = useState('chat')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [login, setLogin] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [newNickname, setNewNickname] = useState('')
  const messagesEndRef = useRef(null)
  const [audio] = useState(new Audio('/notify.mp3'))

  useEffect(() => {
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

  // Функція створення групи
  const createGroup = () => {
    const name = groupNameInput.trim().toLowerCase()
    if (name && !groups.includes(name)) {
      setGroups([...groups, name])
      setCurrentRoom(name)
      setGroupNameInput('')
      setIsCreatingGroup(false)
      setView('chat')
    }
  }

  const startPrivateChat = (targetLogin) => {
    const myLogin = user.user_metadata?.display_name || user.email;
    const roomId = [myLogin, targetLogin].sort().join('_');
    if (!groups.includes(roomId)) setGroups([...groups, roomId])
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

  useEffect(() => {
    if (!user || view !== 'chat') return
    fetchMessages()

    const channel = supabase
      .channel(`room-${currentRoom}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${currentRoom}` }, 
        (payload) => {
          const incoming = payload.new
          const myName = user.user_metadata?.display_name || user.email
          if (incoming.username !== myName) {
            audio.play().catch(() => {})
            if (Notification.permission === "granted") {
              new Notification(`Група ${currentRoom}: ${incoming.username}`, { body: incoming.messages })
            }
          }
          setMessages((prev) => [...prev, incoming])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, currentRoom, view])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
        <form onSubmit={(e) => {
          e.preventDefault()
          if (isRegistering) {
            supabase.auth.signUp({ email, password, options: { data: { display_name: login } } })
          } else {
            supabase.auth.signInWithPassword({ email, password })
          }
        }} style={styles.loginBox}>
          <h3>{isRegistering ? 'Реєстрація' : 'Вхід'}</h3>
          {isRegistering && <input style={styles.input} placeholder="Логін" value={login} onChange={e => setLogin(e.target.value)} required />}
          <input style={styles.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={styles.input} type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" style={styles.button}>{isRegistering ? 'Створити' : 'Увійти'}</button>
          <p onClick={() => setIsRegistering(!isRegistering)} style={styles.toggleText}>Змінити режим</p>
        </form>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
            <b style={{fontSize: '18px'}}>Чати</b>
            <button onClick={() => setIsCreatingGroup(!isCreatingGroup)} style={styles.addGroupBtn}>+</button>
          </div>
          
          {isCreatingGroup && (
            <div style={{marginBottom: '10px'}}>
              <input 
                style={styles.searchInput} 
                placeholder="Назва групи..." 
                value={groupNameInput}
                onChange={e => setGroupNameInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createGroup()}
              />
              <button onClick={createGroup} style={{...styles.button, width: '100%', marginTop: '5px', padding: '5px'}}>Створити</button>
            </div>
          )}

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
          {groups.map(group => (
            <div 
              key={group}
              onClick={() => { setCurrentRoom(group); setView('chat'); }} 
              style={{...styles.roomItem, background: currentRoom === group && view === 'chat' ? '#eefaff' : 'transparent'}}
            >
              # {group}
            </div>
          ))}
        </div>

        <div style={styles.sidebarFooter}>
          <div onClick={() => setView('profile')} style={styles.profileSummary}>
            👤 <span>{user.user_metadata?.display_name || 'Профіль'}</span>
          </div>
          <button onClick={() => supabase.auth.signOut()} style={styles.logoutBtnSmall}>Вийти</button>
        </div>
      </div>

      {/* MAIN */}
      <div style={styles.chatWindow}>
        {view === 'chat' ? (
          <>
            <div style={styles.header}>
              <span>Група: <b>{currentRoom}</b></span>
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
              <input style={styles.input} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Напишіть у групу..." />
              <button type="submit" style={styles.button}>OK</button>
            </form>
          </>
        ) : (
          <div style={styles.profileContainer}>
            <h3>Профіль</h3>
            <input 
              style={{...styles.input, textAlign: 'center', marginTop: '10px'}} 
              value={newNickname} 
              onChange={e => setNewNickname(e.target.value)} 
            />
            <button onClick={updateProfile} style={{...styles.button, marginTop: '10px'}}>Зберегти</button>
            <button onClick={() => setView('chat')} style={{...styles.button, background: '#ccc', marginTop: '10px'}}>Назад</button>
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
  addGroupBtn: { background: '#3fcf8e', color: 'white', border: 'none', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '20px' },
  searchInput: { width: '100%', padding: '10px', borderRadius: '10px', border: '1px solid #ddd', outline: 'none', boxSizing: 'border-box' },
  searchResults: { background: '#f9f9f9', padding: '5px', borderRadius: '5px', marginTop: '5px' },
  userItem: { padding: '10px', cursor: 'pointer', borderRadius: '5px', color: '#0084ff' },
  roomItem: { padding: '15px', cursor: 'pointer', fontWeight: 'bold', borderBottom: '1px solid #f9f9f9' },
  sidebarFooter: { padding: '15px', borderTop: '1px solid #eee', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  profileSummary: { cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' },
  chatWindow: { flex: 1, display: 'flex', flexDirection: 'column', background: 'white' },
  header: { padding: '15px 20px', background: 'white', borderBottom: '1px solid #eee' },
  messagesList: { flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f9f9f9' },
  messageBubble: { color: 'white', padding: '10px 14px', maxWidth: '75%' },
  inputArea: { padding: '15px 20px', display: 'flex', gap: '10px', borderTop: '1px solid #eee' },
  input: { flex: 1, padding: '12px', borderRadius: '20px', border: '1px solid #ddd' },
  button: { background: '#3fcf8e', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold' },
  loginBox: { margin: 'auto', background: 'white', padding: '40px', borderRadius: '20px', textAlign: 'center', width: '320px' },
  logoutBtnSmall: { color: '#ff4d4d', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px' },
  toggleText: { cursor: 'pointer', fontSize: '12px', marginTop: '15px', color: '#0084ff' },
  profileContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
}

export default App