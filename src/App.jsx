import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [currentRoom, setCurrentRoom] = useState('Загальний');
  const [groups, setGroups] = useState(['Загальний']);
  const [activeScreen, setActiveScreen] = useState('list'); 
  
  const [isRegistering, setIsRegistering] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [inputName, setInputName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, setLogin] = useState('');
  const [newNickname, setNewNickname] = useState('');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) setNewNickname(session.user.user_metadata?.display_name || '');
    });
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data } = await supabase.from('rooms').select('name');
      if (data) {
        const roomNames = data.map(r => r.name);
        setGroups([...new Set(['Загальний', ...roomNames])]);
      }
    } catch (e) { console.error(e); }
  };

  const fetchMessages = async () => {
    if (!user || activeScreen !== 'chat') return;
    const { data } = await supabase.from('messages').select('*').eq('room_id', currentRoom).order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  useEffect(() => {
    if (activeScreen === 'chat') {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [user, currentRoom, activeScreen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  const addFriend = async () => {
    const target = inputName.trim();
    if (!target) return;
    const myName = user.user_metadata?.display_name || "Користувач";
    const roomName = [myName, target].sort().join(' & ');
    createRoomInDB(roomName);
  };

  const createNewGroup = async () => {
    const groupName = inputName.trim();
    if (!groupName) return;
    createRoomInDB(groupName);
  };

  const createRoomInDB = async (name) => {
    const { error } = await supabase.from('rooms').insert([{ name, created_by: user.id }]);
    if (!error || error.code === '23505') {
      setGroups(prev => [...new Set([...prev, name])]);
      setIsAddingFriend(false);
      setInputName('');
      setCurrentRoom(name);
      setActiveScreen('chat');
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

  if (!user) return (
    <div style={st.authWrapper}>
      <div style={st.loginBox}>
        <div style={st.authLogo}>M</div>
        <h2 style={{color: '#346191', margin: '10px 0'}}>Mova</h2>
        {isRegistering && <input style={st.input} placeholder="Твій Username" onChange={e => setLogin(e.target.value)} />}
        <input style={st.input} type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} />
        <input style={st.input} type="password" placeholder="Пароль" onChange={e => setPassword(e.target.value)} />
        <button onClick={async () => {
           const { error } = isRegistering 
           ? await supabase.auth.signUp({ email, password, options: { data: { display_name: login } } })
           : await supabase.auth.signInWithPassword({ email, password });
           if (error) alert(error.message);
        }} style={st.btn}>{isRegistering ? 'РЕЄСТРАЦІЯ' : 'УВІЙТИ'}</button>
        <p onClick={() => setIsRegistering(!isRegistering)} style={st.link}>Змінити режим</p>
      </div>
    </div>
  );

  return (
    <div style={st.appFrame}>
      {activeScreen === 'list' && (
        <div style={st.screen}>
          <div style={st.header}>
            <div style={st.logoMini}>M</div>
            <b style={{fontSize: '22px', marginLeft: '10px', color: '#346191'}}>Mova</b>
            <button onClick={() => setIsAddingFriend(!isAddingFriend)} style={st.plusBtn}>+</button>
          </div>
          
          <div style={st.content}>
            {isAddingFriend && (
              <div style={st.createGroupBar}>
                <input style={st.inputSmall} placeholder="Username друга або назва групи" value={inputName} onChange={e => setInputName(e.target.value)} />
                <div style={{display:'flex', gap:'8px'}}>
                  <button onClick={addFriend} style={st.btnSmall}>+ Друг</button>
                  <button onClick={createNewGroup} style={{...st.btnSmall, background:'#4fae4e'}}>+ Група</button>
                </div>
              </div>
            )}
            {groups.map(g => (
              <div key={g} onClick={() => { setCurrentRoom(g); setActiveScreen('chat'); }} style={st.roomItem}>
                <div style={st.avatar}>{g[0].toUpperCase()}</div>
                <div style={st.roomInfo}>
                  <div style={st.roomName}>{g}</div>
                  <div style={st.roomLastMsg}>{g.includes('&') ? 'Приватний чат' : 'Група'}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={st.footerNav}>
            <div onClick={() => setActiveScreen('profile')} style={st.navItem}>
              <span style={{fontSize:'20px'}}>⚙️</span>
              <span>Налаштування</span>
            </div>
            <div onClick={() => supabase.auth.signOut()} style={{...st.navItem, color: '#e53935'}}>
              <span style={{fontSize:'20px'}}>🚪</span>
              <span>Вихід</span>
            </div>
          </div>
        </div>
      )}

      {activeScreen === 'chat' && (
        <div style={st.screen}>
          <div style={st.header}>
            <button onClick={() => setActiveScreen('list')} style={st.backBtn}>←</button>
            <b style={{marginLeft: '15px'}}>{currentRoom}</b>
          </div>
          <div style={st.msgArea}>
            {messages.map(m => {
              const isMine = m.username === (user.user_metadata?.display_name || user.email);
              return (
                <div key={m.id} style={{...st.bubble, alignSelf: isMine ? 'flex-end' : 'flex-start', background: isMine ? '#d1eaff' : '#fff'}}>
                  <div style={{fontSize:'10px', color:'#346191', fontWeight:'bold'}}>{m.username}</div>
                  <div>{m.messages}</div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={sendMessage} style={st.inputBar}>
            <input style={st.input} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Повідомлення..." />
            <button type="submit" style={st.sendBtn}>➤</button>
          </form>
        </div>
      )}

      {activeScreen === 'profile' && (
        <div style={st.screen}>
          <div style={st.header}>
            <button onClick={() => setActiveScreen('list')} style={st.backBtn}>←</button>
            <b style={{marginLeft: '15px'}}>Профіль</b>
          </div>
          <div style={st.profileContent}>
            <div style={st.bigAvatar}>{newNickname[0] || 'M'}</div>
            <input style={st.input} value={newNickname} onChange={e => setNewNickname(e.target.value)} placeholder="Username" />
            <button onClick={async () => { await supabase.auth.updateUser({ data: { display_name: newNickname } }); setActiveScreen('list'); }} style={st.btn}>ЗБЕРЕГТИ</button>
          </div>
        </div>
      )}
    </div>
  );
}

const st = {
  appFrame: { width: '100vw', height: '100dvh', background: '#fff', position: 'fixed', top: 0, left: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  screen: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#fff' },
  header: { padding: '15px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', flexShrink: 0, zIndex: 10 },
  logoMini: { width:'32px', height:'32px', background:'#346191', borderRadius:'8px', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold' },
  content: { flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1 },
  footerNav: { height: '70px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#fff', flexShrink: 0, zIndex: 100, position: 'relative' },
  navItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flex: 1, padding: '10px' },
  msgArea: { flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#f0f2f5' },
  inputBar: { padding: '10px 15px', display: 'flex', background: '#fff', borderTop: '1px solid #eee' },
  input: { flex: 1, padding: '12px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none' },
  sendBtn: { background: 'none', border: 'none', color: '#346191', fontSize: '28px' },
  roomItem: { display: 'flex', padding: '15px', borderBottom: '1px solid #f9f9f9', alignItems: 'center', gap: '15px' },
  avatar: { width: '48px', height: '48px', borderRadius: '14px', background: '#346191', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' },
  roomInfo: { flex: 1 },
  roomName: { fontWeight: 'bold' },
  roomLastMsg: { fontSize: '12px', color: '#999' },
  plusBtn: { marginLeft: 'auto', background: 'none', border: 'none', fontSize: '28px', color: '#346191' },
  backBtn: { background: 'none', border: 'none', fontSize: '24px', color: '#346191' },
  bubble: { padding: '10px', borderRadius: '15px', maxWidth: '80%', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' },
  authWrapper: { display: 'flex', height: '100dvh', background: '#346191' },
  loginBox: { margin: 'auto', padding: '30px', background: '#fff', borderRadius: '20px', width: '260px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '10px' },
  authLogo: { width: '60px', height: '60px', background: '#346191', borderRadius: '15px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', margin: '0 auto' },
  btn: { padding: '12px', background: '#346191', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold' },
  link: { fontSize: '12px', color: '#346191', cursor: 'pointer' },
  profileContent: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', gap: '20px' },
  bigAvatar: { width: '100px', height: '100px', borderRadius: '30px', background: '#346191', color: '#fff', fontSize: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  createGroupBar: { padding: '15px', background: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: '10px' },
  inputSmall: { padding: '10px', border: '1px solid #ddd', borderRadius: '10px' },
  btnSmall: { padding: '10px', border: 'none', background: '#346191', color: '#fff', borderRadius: '8px', flex: 1, fontWeight: 'bold' }
};