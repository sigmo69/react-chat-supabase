import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [groups, setGroups] = useState(['general']);
  const [view, setView] = useState('chat');
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
    if (!user) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', currentRoom)
      .order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  useEffect(() => {
    if (!user || view !== 'chat') return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [user, currentRoom, view]);

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
    <div style={st.screen}>
      {/* SIDEBAR - тепер він має горизонтальний скрол на мобільних, якщо потрібно */}
      <div style={st.sidebar}>
        <div style={st.sidebarTop}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <b>Чати</b>
            <button onClick={() => setIsCreatingGroup(!isCreatingGroup)} style={st.plusBtn}>+</button>
          </div>
          {isCreatingGroup && (
            <div style={{marginTop:'10px', display:'flex', gap:'5px'}}>
              <input style={st.inputSmall} placeholder="Назва" onChange={e => setGroupNameInput(e.target.value)} />
              <button onClick={() => {
                const name = groupNameInput.trim().toLowerCase();
                if(name) { setGroups([...groups, name]); setCurrentRoom(name); setIsCreatingGroup(false); }
              }} style={st.btnSmall}>OK</button>
            </div>
          )}
        </div>
        <div style={st.roomsList}>
          {groups.map(g => (
            <div key={g} onClick={() => { setCurrentRoom(g); setView('chat'); }} 
                 style={{...st.roomItem, background: currentRoom === g && view === 'chat' ? '#eefaff' : 'transparent'}}>
              # {g}
            </div>
          ))}
        </div>
        <div style={st.sidebarBottom}>
          <span onClick={() => setView('profile')} style={{cursor:'pointer'}}>⚙️ Профіль</span>
          <button onClick={() => supabase.auth.signOut()} style={st.logout}>Вийти</button>
        </div>
      </div>

      {/* ОСНОВНЕ ВІКНО */}
      <div style={st.main}>
        {view === 'chat' ? (
          <div style={st.chatWrapper}>
            <div style={st.header}>#{currentRoom}</div>
            <div style={st.msgArea}>
              {messages.map(m => (
                <div key={m.id} style={{
                  ...st.bubble,
                  alignSelf: m.username === (user.user_metadata?.display_name || user.email) ? 'flex-end' : 'flex-start',
                  background: m.username === (user.user_metadata?.display_name || user.email) ? '#3fcf8e' : '#0084ff'
                }}>
                  <span style={st.msgUser}>{m.username}</span>
                  {m.messages}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} style={st.inputBar}>
              <input style={st.input} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Повідомлення..." />
              <button type="submit" style={st.btn}>OK</button>
            </form>
          </div>
        ) : (
          <div style={st.profileScreen}>
            <h3>Профіль</h3>
            <input style={st.input} value={newNickname} onChange={e => setNewNickname(e.target.value)} />
            <button onClick={async () => {
              await supabase.auth.updateUser({ data: { display_name: newNickname } });
              setView('chat');
            }} style={{...st.btn, marginTop:'10px'}}>Зберегти</button>
          </div>
        )}
      </div>
    </div>
  );
}

const st = {
  // ФІКС: Забороняємо будь-який рух вгору-вниз для всього екрана
  screen: { 
    display: 'flex', 
    width: '100vw', 
    height: '100dvh', 
    position: 'fixed', 
    top: 0, 
    left: 0, 
    overflow: 'hidden', // ВАЖЛИВО: жодних рухів всього екрана
    touchAction: 'none' // Забороняє браузерні жести прокрутки
  },
  sidebar: { 
    width: '240px', 
    background: '#fff', 
    borderRight: '1px solid #ddd', 
    display: 'flex', 
    flexDirection: 'column',
    touchAction: 'pan-y' // Дозволяє скрол тільки всередині сайдбара
  },
  main: { 
    flex: 1, 
    background: '#fff', 
    position: 'relative',
    touchAction: 'none' 
  },
  chatWrapper: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: { padding: '15px', borderBottom: '1px solid #eee', fontWeight: 'bold', flexShrink: 0 },
  msgArea: { 
    flex: 1, 
    overflowY: 'auto', 
    padding: '15px', 
    display: 'flex', 
    flexDirection: 'column', 
    gap: '8px', 
    background: '#f9f9f9',
    touchAction: 'pan-y' // Дозволяє скрол тільки повідомленням
  },
  inputBar: { padding: '10px', display: 'flex', gap: '5px', borderTop: '1px solid #eee', background: '#fff', flexShrink: 0 },
  bubble: { color: 'white', padding: '8px 12px', borderRadius: '15px', maxWidth: '85%' },
  msgUser: { display: 'block', fontSize: '10px', opacity: 0.8, marginBottom: '2px' },
  input: { flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid #ccc', fontSize: '16px', outline: 'none' },
  btn: { padding: '10px 20px', background: '#3fcf8e', color: 'white', border: 'none', borderRadius: '20px', fontWeight: 'bold' },
  plusBtn: { width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: '#3fcf8e', color: 'white', fontSize: '20px' },
  sidebarTop: { padding: '15px', borderBottom: '1px solid #eee' },
  roomsList: { flex: 1, overflowY: 'auto', padding: '10px' },
  roomItem: { padding: '10px', cursor: 'pointer', borderRadius: '8px' },
  sidebarBottom: { padding: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between' },
  authWrapper: { display: 'flex', height: '100dvh', background: '#f0f2f5' },
  loginBox: { margin: 'auto', padding: '30px', background: '#fff', borderRadius: '15px', display: 'flex', flexDirection: 'column', gap: '15px', width: '280px', textAlign: 'center' },
  logout: { border: 'none', background: 'none', color: 'red', cursor: 'pointer' },
  profileScreen: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', touchAction: 'pan-y' },
  link: { color: '#0084ff', cursor: 'pointer', fontSize: '12px' },
  inputSmall: { flex: 1, padding: '5px', borderRadius: '5px', border: '1px solid #ccc' },
  btnSmall: { padding: '5px', background: '#3fcf8e', color: '#fff', border: 'none', borderRadius: '5px' }
};