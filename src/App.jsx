import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [groups, setGroups] = useState(['general']);
  
  // Керування екранами: 'list' (список чатів), 'chat' (вікно чату), 'profile' (профіль)
  const [activeScreen, setActiveScreen] = useState('list'); 
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, setLogin] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [groupNameInput, setGroupNameInput] = useState('');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) setNewNickname(session.user.user_metadata?.display_name || '');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchMessages = async () => {
    if (!user || activeScreen !== 'chat') return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', currentRoom)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [user, currentRoom, activeScreen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isRegistering) {
      const { error } = await supabase.auth.signUp({ 
        email, password, options: { data: { display_name: login } } 
      });
      if (error) alert(error.message);
      else alert('Успіх! Увійдіть.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) alert(error.message);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const name = user.user_metadata?.display_name || user.email;
    await supabase.from('messages').insert([{ messages: newMessage, username: name, room_id: currentRoom }]);
    setNewMessage('');
    fetchMessages();
  };

  if (!user) {
    return (
      <div style={st.authWrapper}>
        <form onSubmit={handleAuth} style={st.loginBox}>
          <h2 style={{color: '#3fcf8e'}}>Messenger</h2>
          {isRegistering && <input style={st.input} placeholder="Нікнейм" onChange={e => setLogin(e.target.value)} required />}
          <input style={st.input} type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} required />
          <input style={st.input} type="password" placeholder="Пароль" onChange={e => setPassword(e.target.value)} required />
          <button type="submit" style={st.btn}>OK</button>
          <p onClick={() => setIsRegistering(!isRegistering)} style={st.link}>
            {isRegistering ? 'Вхід' : 'Реєстрація'}
          </p>
        </form>
      </div>
    );
  }

  return (
    <div style={st.appFrame}>
      
      {/* 1. ЕКРАН СПИСКУ ЧАТІВ */}
      {activeScreen === 'list' && (
        <div style={st.screen}>
          <div style={st.header}>
            <b>Messenger</b>
            <button onClick={() => setIsCreatingGroup(!isCreatingGroup)} style={st.plusBtn}>+</button>
          </div>
          
          <div style={st.content}>
            {isCreatingGroup && (
              <div style={st.createGroupBar}>
                <input style={st.inputSmall} placeholder="Назва кімнати" onChange={e => setGroupNameInput(e.target.value)} />
                <button onClick={() => {
                  const name = groupNameInput.trim().toLowerCase();
                  if(name) { setGroups([...groups, name]); setIsCreatingGroup(false); }
                }} style={st.btnSmall}>Створити</button>
              </div>
            )}
            
            {groups.map(g => (
              <div key={g} onClick={() => { setCurrentRoom(g); setActiveScreen('chat'); }} style={st.roomItem}>
                <div style={st.avatar}>{g[0].toUpperCase()}</div>
                <div style={st.roomInfo}>
                  <div style={st.roomName}># {g}</div>
                  <div style={st.roomLastMsg}>Натисніть, щоб відкрити чат</div>
                </div>
              </div>
            ))}
          </div>

          <div style={st.footer}>
            <span onClick={() => setActiveScreen('profile')} style={{cursor:'pointer'}}>⚙️ Профіль</span>
            <button onClick={() => supabase.auth.signOut()} style={st.logout}>Вийти</button>
          </div>
        </div>
      )}

      {/* 2. ЕКРАН ЧАТУ */}
      {activeScreen === 'chat' && (
        <div style={st.screen}>
          <div style={st.header}>
            <button onClick={() => setActiveScreen('list')} style={st.backBtn}>←</button>
            <div style={{marginLeft: '15px'}}>
              <b>{currentRoom}</b>
              <div style={{fontSize: '10px', color: '#3fcf8e'}}>онлайн</div>
            </div>
          </div>
          
          <div style={st.msgArea}>
            {messages.map(m => (
              <div key={m.id} style={{
                ...st.bubble,
                alignSelf: m.username === (user.user_metadata?.display_name || user.email) ? 'flex-end' : 'flex-start',
                background: m.username === (user.user_metadata?.display_name || user.email) ? '#3fcf8e' : '#fff',
                color: m.username === (user.user_metadata?.display_name || user.email) ? '#fff' : '#000',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                <span style={{...st.msgUser, color: m.username === (user.user_metadata?.display_name || user.email) ? '#eee' : '#3fcf8e'}}>
                  {m.username}
                </span>
                {m.messages}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} style={st.inputBar}>
            <input style={st.input} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Повідомлення..." />
            <button type="submit" style={st.sendBtn}>➤</button>
          </form>
        </div>
      )}

      {/* 3. ЕКРАН ПРОФІЛЮ */}
      {activeScreen === 'profile' && (
        <div style={st.screen}>
          <div style={st.header}>
            <button onClick={() => setActiveScreen('list')} style={st.backBtn}>←</button>
            <b style={{marginLeft: '15px'}}>Профіль</b>
          </div>
          <div style={st.profileContent}>
            <div style={st.bigAvatar}>{newNickname[0]?.toUpperCase() || 'U'}</div>
            <input style={{...st.input, textAlign: 'center', width: '80%'}} value={newNickname} onChange={e => setNewNickname(e.target.value)} />
            <button onClick={async () => {
              await supabase.auth.updateUser({ data: { display_name: newNickname } });
              alert('Збережено!');
              setActiveScreen('list');
            }} style={{...st.btn, marginTop: '20px', width: '80%'}}>Зберегти зміни</button>
          </div>
        </div>
      )}
    </div>
  );
}

const st = {
  appFrame: {
    width: '100vw',
    height: '100dvh',
    background: '#f0f2f5',
    overflow: 'hidden',
    position: 'fixed'
  },
  screen: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    background: '#f0f2f5',
    position: 'absolute',
    top: 0,
    left: 0
  },
  header: {
    padding: '12px 15px',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '1px solid #ddd',
    flexShrink: 0
  },
  content: { flex: 1, overflowY: 'auto' },
  msgArea: { 
    flex: 1, 
    overflowY: 'auto', 
    padding: '15px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '10px',
    background: '#e5ddd5' // Колір фону як у месенджерах
  },
  footer: { padding: '15px', background: '#fff', borderTop: '1px solid #ddd', display: 'flex', justifyContent: 'space-between' },
  
  roomItem: { 
    display: 'flex', 
    alignItems: 'center', 
    padding: '12px 15px', 
    background: '#fff', 
    borderBottom: '1px solid #f0f0f0',
    cursor: 'pointer' 
  },
  avatar: { width: '45px', height: '45px', borderRadius: '50%', background: '#3fcf8e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' },
  roomInfo: { marginLeft: '15px' },
  roomName: { fontWeight: 'bold', fontSize: '16px' },
  roomLastMsg: { fontSize: '12px', color: '#888' },

  backBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#3fcf8e' },
  plusBtn: { marginLeft: 'auto', background: 'none', border: 'none', fontSize: '24px', color: '#3fcf8e', cursor: 'pointer' },
  
  bubble: { padding: '8px 12px', borderRadius: '12px', maxWidth: '85%', fontSize: '15px', position: 'relative' },
  msgUser: { display: 'block', fontSize: '10px', fontWeight: 'bold', marginBottom: '2px' },
  
  inputBar: { padding: '10px', display: 'flex', gap: '10px', background: '#fff', alignItems: 'center', paddingBottom: 'env(safe-area-inset-bottom, 10px)' },
  input: { flex: 1, padding: '10px 15px', borderRadius: '20px', border: '1px solid #ddd', fontSize: '16px', outline: 'none' },
  sendBtn: { background: '#3fcf8e', color: '#fff', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  
  btn: { padding: '12px', background: '#3fcf8e', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold' },
  authWrapper: { display: 'flex', height: '100dvh', background: '#f0f2f5', width: '100vw' },
  loginBox: { margin: 'auto', padding: '30px', background: '#fff', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '15px', width: '280px', textAlign: 'center' },
  link: { color: '#0084ff', cursor: 'pointer', fontSize: '13px' },
  logout: { color: 'red', border: 'none', background: 'none', cursor: 'pointer' },
  
  profileContent: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' },
  bigAvatar: { width: '80px', height: '80px', borderRadius: '50%', background: '#3fcf8e', color: '#fff', fontSize: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' },
  createGroupBar: { padding: '15px', background: '#fff', borderBottom: '1px solid #ddd', display: 'flex', gap: '10px' },
  inputSmall: { flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: '5px' },
  btnSmall: { padding: '8px', background: '#3fcf8e', color: '#fff', border: 'none', borderRadius: '5px' }
};