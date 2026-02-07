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
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
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

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return
    const name = user.user_metadata?.display_name || user.email
    const { error } = await supabase.from('messages').insert([{ 
      messages: newMessage, username: name, room_id: currentRoom 
    }])
    if (!error) {
      setNewMessage('')
      fetchMessages()
    }
  }

  // --- РЕНДЕР: ВХІД ---
  if (!user) {
    return (
      <div style={styles.container}>
        <form onSubmit={handleAuth} style={styles.loginBox}>
          <h2 style={{ color: '#3fcf8e', marginBottom: '20px' }}>
            {isRegistering ? 'Реєстрація' : 'Вхід'}
          </h2>
          {isRegistering && (
            <input style={styles.input} placeholder="Логін" value={login} onChange={e => setLogin(e.target.value)} required />
          )}
          <input style={styles.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input style={styles.input} type="password" placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" style={styles.button}>{isRegistering ? 'Зареєструватися' : 'Увійти'}</button>
          <p onClick={() => setIsRegistering(!isRegistering)} style={styles.toggleText}>
            {isRegistering ? 'Вже є акаунт? Увійти' : 'Немає акаунта? Зареєструватися'}
          </p>
        </form>
      </div>
    )
  }

  // --- РЕНДЕР: ДОДАТОК ---
  return (
    <div style={styles.container}>
      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
            <b>Чати</b>
            <button onClick={() => setIsCreatingGroup(!isCreatingGroup)} style={styles.addGroupBtn}>+</button>
          </div>
          {isCreatingGroup && (
            <div style={{display: 'flex', gap: '5px', marginBottom: '10px'}}>
              <input style={{...styles.input, padding: '8px'}} placeholder="Назва" value={groupNameInput} onChange={e => setGroupNameInput(e.target.value)} />
              <button onClick={() => {
                const name = groupNameInput.trim().toLowerCase();
                if(name) { setGroups([...groups, name]); setCurrentRoom(name); setGroupNameInput(''); setIsCreatingGroup(false); }
              }} style={{...styles.button, padding: '5px 10px'}}>OK</button>
            </div>
          )}
          <input style={styles.searchInput} placeholder="Пошук..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          {searchQuery && (
            <div style={styles.searchResults} onClick={() => {
              const myLogin = user.user_metadata?.display_name || user.email;
              const roomId = [myLogin, searchQuery].sort().join('_');
              if (!groups.includes(roomId)) setGroups([...groups, roomId]);
              setCurrentRoom(roomId); setSearchQuery(''); setView('chat');
            }}>👤 Чат з {searchQuery}</div>
          )}
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {groups.map(g => (
            <div key={g} onClick={() => { setCurrentRoom(g); setView('chat'); }} style={{...styles.roomItem, background: currentRoom === g ? '#eefaff' : 'transparent'}}>
              {g.includes('_') ? `👤 ${g.split('_').find(n => n !== (user.user_metadata?.display_name || user.email))}` : `# ${g}`}
            </div>
          ))}
        </div>
        <div style={styles.sidebarFooter}>
          <span onClick={() => setView('profile')} style={{cursor:'pointer'}}>⚙️ Профіль</span>
          <button onClick={() => supabase.auth.signOut()} style={styles.logoutBtnSmall}>Вийти</button>
        </div>
      </div>

      {/* CHAT WINDOW */}
      <div style={styles.chatWindow}>
        {view === 'chat' ? (
          <div style={styles.chatFlexWrapper}>
            <div style={styles.header}>
              <b>{currentRoom.includes('_') ? 'Приватний чат' : `# ${currentRoom}`}</b>
            </div>
            <div style={styles.messagesList}>
              {messages.map(msg => (
                <div key={msg.id} style={{
                  ...styles.messageBubble,
                  alignSelf: msg.username === (user.user_metadata?.display_name || user.email) ? 'flex-end' : 'flex-start',
                  background: msg.username === (user.user_metadata?.display_name || user.email) ? '#3fcf8e' : '#0084ff',
                  borderRadius: msg.username === (user.user_metadata?.display_name || user.email) ? '15px 15px 2px 15px' : '15px 15px 15px 2px'
                }}>
                  <div style={{fontSize: '10px', opacity: 0.8, marginBottom: '2px'}}>{msg.username}</div>
                  <div style={{wordBreak: 'break-word'}}>{msg.messages}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} style={styles.inputArea}>
              <input style={styles.input} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Повідомлення..." />
              <button type="submit" style={styles.button}>OK</button>
            </form>
          </div>
        ) : (
          <div style={styles.profileContainer}>
            <h3>Налаштування</h3>
            <input style={{...styles.input, textAlign: 'center', marginBottom: '10px'}} value={newNickname} onChange={e => setNewNickname(e.target.value)} />
            <button onClick={async () => {
              await supabase.auth.updateUser({ data: { display_name: newNickname } });
              setView('chat');
            }} style={styles.button}>Зберегти</button>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: { background: '#f0f2f5', height: '100dvh', display: 'flex', fontFamily: 'sans-serif', overflow: 'hidden' },
  sidebar: { width: '260px', background: 'white', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column', flexShrink: 0 },
  sidebarHeader: { padding: '15px', borderBottom: '1px solid #eee' },
  addGroupBtn: { background: '#3fcf8e', color: 'white', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '4px' },
  searchInput: { width: '100%', padding: '8px', borderRadius: '10px', border: '1px solid #ddd', outline: 'none' },
  searchResults: { background: '#eefaff', padding: '10px', borderRadius: '8px', marginTop: '10px', cursor: 'pointer', color: '#0084ff', fontSize: '14px' },
  roomItem: { padding: '12px 15px', cursor: 'pointer', borderBottom: '1px solid #f9f9f9', fontSize: '14px' },
  sidebarFooter: { padding: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', fontSize: '12px' },
  chatWindow: { flex: 1, position: 'relative', background: 'white', minWidth: 0 },
  chatFlexWrapper: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: { padding: '15px', borderBottom: '1px solid #eee', background: 'white', flexShrink: 0 },
  messagesList: { flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', background: '#f9f9f9' },
  messageBubble: { color: 'white', padding: '8px 12px', maxWidth: '85%', fontSize: '15px' },
  inputArea: { padding: '10px 15px', display: 'flex', gap: '8px', borderTop: '1px solid #eee', background: 'white', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom, 10px)' },
  input: { flex: 1, padding: '10px 15px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none', fontSize: '16px' },
  button: { background: '#3fcf8e', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' },
  loginBox: { margin: 'auto', background: 'white', padding: '30px', borderRadius: '20px', textAlign: 'center', width: '90%', maxWidth: '320px' },
  logoutBtnSmall: { color: 'red', border: 'none', background: 'none', cursor: 'pointer' },
  toggleText: { cursor: 'pointer', fontSize: '13px', marginTop: '15px', color: '#0084ff', textDecoration: 'underline' },
  profileContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }
}

export default App