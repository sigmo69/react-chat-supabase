import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [groups, setGroups] = useState(['general']);
  const [view, setView] = useState('chat'); // 'chat' або 'profile'
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
      if (session?.user) setNewNickname(session.user.user_metadata?.display_name || '');
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAuth = async (e) => {
    e.preventDefault();
    if (isRegistering) {
      const { error } = await supabase.auth.signUp({ 
        email, 
        password, 
        options: { data: { display_name: login } } 
      });
      if (error) alert(error.message);
      else alert('Реєстрація успішна! Увійдіть.');
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

  const createNewGroup = () => {
    const name = groupNameInput.trim().toLowerCase();
    if (name && !groups.includes(name)) {
      setGroups([...groups, name]);
      setCurrentRoom(name);
      setGroupNameInput('');
      setIsCreatingGroup(false);
    }
  };

  if (!user) {
    return (
      <div style={st.container}>
        <form onSubmit={handleAuth} style={st.loginBox}>
          <h2 style={{color: '#3fcf8e'}}>Чат</h2>
          {isRegistering && (
            <input style={st.input} placeholder="Логін (нікнейм)" onChange={e => setLogin(e.target.value)} required />
          )}
          <input style={st.input} type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} required />
          <input style={st.input} type="password" placeholder="Пароль" onChange={e => setPassword(e.target.value)} required />
          <button type="submit" style={st.btn}>{isRegistering ? 'Зареєструватися' : 'Увійти'}</button>
          <p onClick={() => setIsRegistering(!isRegistering)} style={st.link}>
            {isRegistering ? 'Вже є акаунт? Увійти' : 'Немає акаунта? Створити'}
          </p>
        </form>
      </div>
    );
  }

  return (
    <div style={st.container}>
      {/* SIDEBAR */}
      <div style={st.sidebar}>
        <div style={st.sidebarContent}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
            <b>Кімнати</b>
            <button onClick={() => setIsCreatingGroup(!isCreatingGroup)} style={st.circleBtn}>+</button>
          </div>

          {isCreatingGroup && (
            <div style={{marginBottom: '10px', display: 'flex', gap: '5px'}}>
              <input 
                style={{...st.input, padding: '5px'}} 
                placeholder="Назва..." 
                value={groupNameInput}
                onChange={e => setGroupNameInput(e.target.value)}
              />
              <button onClick={createNewGroup} style={st.btnSmall}>OK</button>
            </div>
          )}

          {groups.map(g => (
            <div key={g} onClick={() => { setCurrentRoom(g); setView('chat'); }} 
                 style={{...st.roomItem, background: currentRoom === g && view === 'chat' ? '#eefaff' : 'none'}}>
              # {g}
            </div>
          ))}
        </div>

        <div style={st.sidebarFooter}>
          <div onClick={() => setView('profile')} style={{cursor: 'pointer', fontWeight: 'bold'}}>
            ⚙️ {user.user_metadata?.display_name || 'Профіль'}
          </div>
          <button onClick={() => supabase.auth.signOut()} style={st.logoutBtn}>Вийти</button>
        </div>
      </div>

      {/* ОСНОВНА ЧАСТИНА */}
      <div style={st.main}>
        {view === 'chat' ? (
          <div style={st.chatContainer}>
            <div style={st.header}>Кімната: #{currentRoom}</div>
            <div style={st.msgList}>
              {messages.map(m => (
                <div key={m.id} style={{
                  ...st.bubble,
                  alignSelf: m.username === (user.user_metadata?.display_name || user.email) ? 'flex-end' : 'flex-start',
                  background: m.username === (user.user_metadata?.display_name || user.email) ? '#3fcf8e' : '#0084ff'
                }}>
                  <small style={{display: 'block', fontSize: '10px', opacity: 0.8}}>{m.username}</small>
                  {m.messages}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} style={st.inputArea}>
              <input style={st.input} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Напишіть щось..." />
              <button type="submit" style={st.btn}>OK</button>
            </form>
          </div>
        ) : (
          <div style={st.profileScreen}>
            <h3>Налаштування профілю</h3>
            <p>Email: {user.email}</p>
            <input 
              style={{...st.input, width: '250px', textAlign: 'center'}} 
              value={newNickname} 
              onChange={e => setNewNickname(e.target.value)} 
              placeholder="Ваш нікнейм"
            />
            <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
               <button onClick={() => setView('chat')} style={{...st.btn, background: '#ccc'}}>Назад</button>
               <button onClick={async () => {
                 await supabase.auth.updateUser({ data: { display_name: newNickname } });
                 alert('Оновлено!');
                 setView('chat');
               }} style={st.btn}>Зберегти</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const st = {
  container: { display: 'flex', height: '100dvh', fontFamily: 'sans-serif', overflow: 'hidden', background: '#f0f2f5' },
  sidebar: { width: '250px', background: '#fff', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' },
  sidebarContent: { flex: 1, padding: '15px', overflowY: 'auto' },
  sidebarFooter: { padding: '15px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' },
  chatContainer: { display: 'flex', flexDirection: 'column', height: '100%' },
  header: { padding: '15px', borderBottom: '1px solid #eee', fontWeight: 'bold' },
  msgList: { flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px' },
  bubble: { color: 'white', padding: '8px 12px', borderRadius: '12px', maxWidth: '80%' },
  inputArea: { padding: '15px', display: 'flex', gap: '10px', borderTop: '1px solid #eee', paddingBottom: 'env(safe-area-inset-bottom, 15px)' },
  input: { flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid #ccc', fontSize: '16px', outline: 'none' },
  btn: { padding: '10px 20px', background: '#3fcf8e', color: 'white', border: 'none', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer' },
  btnSmall: { padding: '5px 10px', background: '#3fcf8e', color: 'white', border: 'none', borderRadius: '5px' },
  circleBtn: { width: '30px', height: '30px', borderRadius: '50%', border: 'none', background: '#3fcf8e', color: 'white', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '4px' },
  roomItem: { padding: '10px', cursor: 'pointer', borderRadius: '8px', marginBottom: '2px' },
  loginBox: { margin: 'auto', padding: '30px', background: '#fff', borderRadius: '15px', display: 'flex', flexDirection: 'column', gap: '15px', width: '300px', textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' },
  link: { color: '#0084ff', cursor: 'pointer', fontSize: '13px' },
  logoutBtn: { background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontSize: '12px' },
  profileScreen: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }
};