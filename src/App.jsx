import { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [username, setUsername] = useState(localStorage.getItem('chat-username') || '')
  const [tempName, setTempName] = useState('')
  const messagesEndRef = useRef(null)

  // Функція для красивого форматування часу
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
      
      if (error) throw error
      if (data) setMessages(data)
    } catch (err) {
      console.error('Помилка отримання:', err.message)
    }
  }

  // --- НОВА ФУНКЦІЯ ВИДАЛЕННЯ ---
  const deleteMessage = async (id) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Оновлюємо стан локально, щоб повідомлення зникло миттєво
      setMessages((prev) => prev.filter((msg) => msg.id !== id));
    } catch (err) {
      console.error('Помилка видалення:', err.message);
      alert('Не вдалося видалити повідомлення');
    }
  }

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleLogin = (e) => {
    e.preventDefault()
    if (tempName.trim()) {
      setUsername(tempName)
      localStorage.setItem('chat-username', tempName)
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    const textToSend = newMessage
    setNewMessage('')

    const { error } = await supabase
      .from('messages')
      .insert([{ 
        messages: textToSend, 
        username: username 
      }])

    if (error) {
      alert(`Помилка відправки: ${error.message}`)
      setNewMessage(textToSend) 
    } else {
      fetchMessages()
    }
  }

  const logout = () => {
    localStorage.removeItem('chat-username')
    setUsername('')
  }

  if (!username) {
    return (
      <div style={styles.container}>
        <form onSubmit={handleLogin} style={styles.loginBox}>
          <h3 style={{ marginTop: 0 }}>Представтеся:</h3>
          <input 
            style={styles.input} 
            value={tempName} 
            onChange={(e) => setTempName(e.target.value)} 
            placeholder="Ваше ім'я..." 
            autoFocus
          />
          <button type="submit" style={{...styles.button, marginTop: '15px', width: '100%'}}>Увійти</button>
        </form>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.chatWindow}>
        <div style={styles.header}>
          <div>
            <h2 style={{ margin: 0 }}>Чат 💬</h2>
            <span style={{ fontSize: '12px', color: '#666' }}>Ви: <b>{username}</b></span>
          </div>
          <button onClick={logout} style={styles.logoutBtn}>Вийти</button>
        </div>
        
        <div style={styles.messagesList}>
          {messages.map((msg) => (
            <div key={msg.id} style={{
              ...styles.messageBubble,
              alignSelf: msg.username === username ? 'flex-end' : 'flex-start',
              background: msg.username === username ? '#3fcf8e' : '#0084ff',
              borderRadius: msg.username === username ? '15px 15px 2px 15px' : '15px 15px 15px 2px',
              position: 'relative' // Важливо для позиціювання кнопки видалення
            }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', marginBottom: '3px', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                <span>{msg.username || 'Гість'}</span>
                <span style={{ opacity: 0.7, fontWeight: 'normal' }}>{formatTime(msg.created_at)}</span>
              </div>
              <div style={{ paddingRight: msg.username === username ? '20px' : '0' }}>
                {msg.messages}
              </div>
              
              {/* Кнопка видалення (показуємо тільки для твоїх повідомлень) */}
              {msg.username === username && (
                <button 
                  onClick={() => deleteMessage(msg.id)} 
                  style={styles.deleteBtn}
                  title="Видалити"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} style={styles.inputArea}>
          <input 
            type="text" 
            value={newMessage} 
            onChange={(e) => setNewMessage(e.target.value)} 
            placeholder="Повідомлення..."
            style={styles.input}
          />
          <button type="submit" style={styles.button}>OK</button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  container: { background: '#f0f2f5', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif' },
  loginBox: { background: 'white', padding: '30px', borderRadius: '15px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', textAlign: 'center' },
  chatWindow: { width: '100%', maxWidth: '450px', height: '90vh', background: 'white', borderRadius: '20px', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', overflow: 'hidden' },
  header: { padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logoutBtn: { background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  messagesList: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f9f9f9' },
  messageBubble: { color: 'white', padding: '10px 14px', maxWidth: '80%', wordWrap: 'break-word', minWidth: '60px' },
  inputArea: { display: 'flex', gap: '10px', padding: '15px 20px', borderTop: '1px solid #eee' },
  input: { flex: 1, padding: '12px 15px', borderRadius: '25px', border: '1px solid #ddd', outline: 'none' },
  button: { background: '#3fcf8e', color: 'white', border: 'none', padding: '10px 25px', borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold' },
  // Стиль кнопки видалення
  deleteBtn: {
    position: 'absolute',
    right: '8px',
    bottom: '8px',
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '0',
    lineHeight: '1',
    transition: 'color 0.2s'
  }
}

export default App