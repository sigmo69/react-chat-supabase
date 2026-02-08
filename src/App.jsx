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

  // Слідкуємо за авторизацією
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        setNewNickname(session.user.user_metadata?.display_name || '');
        fetchRooms();
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchRooms();
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase.from('rooms').select('name');
      if (error) throw error;
      if (data) {
        const roomNames = data.map(r => r.name);
        setGroups([...new Set(['Загальний', ...roomNames])]);
      }
    } catch (e) { 
      console.error("Помилка завантаження кімнат:", e.message); 
    }
  };

  const fetchMessages = async () => {
    if (!user || activeScreen !== 'chat') return;
    const { data } = await supabase.from('messages')
      .select('*')
      .eq('room_id', currentRoom)
      .order('created_at', { ascending: true });
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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAuth = async () => {
    if (!email || !password) return alert("Заповни Email та Пароль!");
    
    try {
      if (isRegistering) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: login } }
        });
        if (error) throw error;
        alert("Реєстрація успішна! Якщо в налаштуваннях Supabase увімкнено підтвердження, перевір пошту.");
      } else {
        const { data, error } = await supabase.signInWithPassword({ email, password });
        if (error) throw error;
        setUser(data.user);
      }
    } catch (err) {
      alert("Помилка: " + err.message);
    }
  };

  const createRoom = async (type) => {
    const name = inputName.trim();
    if (!name) return;
    
    let roomName = name;
    if (type === 'friend') {
      const myName = user.user_metadata?.display_name || user.email.split('@')[0];
      roomName = [myName, name].sort().join(' & ');
    }

    const { error } = await supabase.from('rooms').insert([{ name: roomName, created_by: user.id }]);
    if (!error || error.code === '23505') {
      setGroups(prev => [...new Set([...prev, roomName])]);
      setIsAddingFriend(false);
      setInputName('');
      setCurrentRoom(roomName);
      setActiveScreen('chat');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const name = user.user_metadata?.display_name || user.email;
    await supabase.from('messages').insert([{ 
      messages: newMessage, 
      username: name, 
      room_id: currentRoom 
    }]);
    setNewMessage('');
    fetchMessages();
  };

  // Екран входу
  if (!user) return (
    <div style={st.authWrapper}>
      <div style={st.loginBox}>
        <div style={st.authLogo}>M</div>
        <h2 style={{color: '#346191', marginBottom: '5px'}}>Mova</h2>
        <p style={{fontSize: '12px', color: '#888', marginBottom: '15px'}}>Твоя мова — твій зв'язок</p>
        
        {isRegistering && (
          <input style={st.input} placeholder="Username" value={login} onChange={e => setLogin(e.target.value)} />
        )}
        <input style={st.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={st.input} type="password" placeholder="Пароль (мін. 6 симв.)" value={password} onChange={e => setPassword(e.target.value)} />
        
        <button onClick={handleAuth} style={st.btn}>
          {isRegistering ? 'СТВОРИТИ АККАУНТ' : 'УВІЙТИ'}
        </button>
        
        <p onClick={() => setIsRegistering(!isRegistering)} style={st.link}>
          {isRegistering ? "Вже є аккаунт? Увійти" : "Немає аккаунту? Реєстрація"}
        </p>
      </div>
    </div>
  );

  return (
    <div style={st.appFrame}>
      {activeScreen === 'list' && (
        <div style={st.screen}>
          <div style={st.header}>
            <div style={st.logoMini}>M</div>
            <b style={{marginLeft: '10px', fontSize: '20px', color: '#346191'}}>Mova</b>
            <button onClick={() => setIsAddingFriend(!isAddingFriend)} style={st.plusBtn}>+</button>
          </div>
          
          <div style={st.content}>
            {isAddingFriend && (
              <div style={st.createGroupBar}>
                <input style={st.inputSmall} placeholder="Username друга або назва групи" value={inputName} onChange={e => setInputName(e.target.value)} />
                <div style={{display:'flex', gap:'8px'}}>
                  <button onClick={() => createRoom('friend')} style={st.btnSmall}>+ Друг</button>
                  <button onClick={() => createRoom('group')} style={{...st.btnSmall, background:'#4fae4e'}}>+ Група</button>
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
              <span style={{fontSize:'22px'}}>⚙️</span>
              <span>Налаштування</span>
            </div>
            <div onClick={() => supabase.auth.signOut()} style={{...st.navItem, color: '#e53935'}}>
              <span style={{fontSize:'22px'}}>🚪</span>
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
                  <div style={{fontSize:'10px', color: isMine ? '#346191' : '#888', fontWeight:'bold'}}>{m.username}</div>
                  <div style={{marginTop:'2px'}}>{m.messages}</div>
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
            <b style={{marginLeft: '15px'}}>Налаштування профілю</b>
          </div>
          <div style={st.profileContent}>
            <div style={st.bigAvatar}>{newNickname[0] || 'M'}</div>
            <p style={{color: '#888', fontSize: '14px'}}>{user.email}</p>
            <input style={st.input} value={newNickname} onChange={e => setNewNickname(e.target.value)} placeholder="Твій Username" />
            <button onClick={async () => {
               await supabase.auth.updateUser({ data: { display_name: newNickname } });
               alert("Оновлено!");
               setActiveScreen('list');
            }} style={st.btn}>ЗБЕРЕГТИ</button>
          </div>
        </div>
      )}
    </div>
  );
}

const st = {
  appFrame: { width: '100vw', height: '100dvh', background: '#fff', position: 'fixed', top: 0, left: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  screen: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#fff' },
  header: { padding: '15px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', flexShrink: 0, background: '#fff' },
  logoMini: { width:'32px', height:'32px', background:'#346191', borderRadius:'8px', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'bold' },
  content: { flex: 1, overflowY: 'auto' },
  footerNav: { height: '75px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#fff', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' },
  navItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', cursor: 'pointer', flex: 1, color: '#346191', fontSize: '12px', fontWeight: '500' },
  msgArea: { flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#f0f2f5' },
  inputBar: { padding: '10px 15px', display: 'flex', background: '#fff', borderTop: '1px solid #eee', alignItems: 'center', paddingBottom: 'env(safe-area-inset-bottom, 10px)' },
  input: { flex: 1, padding: '12px 18px', borderRadius: '25px', border: '1px solid #ddd', outline: 'none', fontSize: '16px' },
  sendBtn: { background: 'none', border: 'none', color: '#346191', fontSize: '28px', cursor: 'pointer', marginLeft: '10px' },
  roomItem: { display: 'flex', padding: '12px 15px', borderBottom: '1px solid #f9f9f9', alignItems: 'center', gap: '15px', cursor: 'pointer' },
  avatar: { width: '50px', height: '50px', borderRadius: '16px', background: 'linear-gradient(45deg, #346191, #6096ba)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '20px' },
  roomInfo: { flex: 1 },
  roomName: { fontWeight: 'bold', color: '#222' },
  roomLastMsg: { fontSize: '12px', color: '#999', marginTop: '2px' },
  plusBtn: { marginLeft: 'auto', background: 'none', border: 'none', fontSize: '30px', color: '#346191', cursor: 'pointer' },
  backBtn: { background: 'none', border: 'none', fontSize: '24px', color: '#346191', cursor: 'pointer' },
  bubble: { padding: '10px 14px', borderRadius: '18px', maxWidth: '75%', boxShadow: '0 1px 2px rgba(0,0,0,0.08)', fontSize: '15px' },
  authWrapper: { display: 'flex', height: '100dvh', background: 'linear-gradient(135deg, #346191 0%, #2a4d73 100%)' },
  loginBox: { margin: 'auto', padding: '35px 25px', background: '#fff', borderRadius: '25px', width: '290px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' },
  authLogo: { width: '70px', height: '70px', background: '#346191', borderRadius: '20px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', fontWeight: 'bold', margin: '0 auto 10px' },
  btn: { padding: '14px', background: '#346191', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', marginTop: '10px' },
  link: { fontSize: '13px', color: '#346191', cursor: 'pointer', fontWeight: '500' },
  profileContent: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', gap: '20px' },
  bigAvatar: { width: '100px', height: '100px', borderRadius: '30px', background: 'linear-gradient(45deg, #346191, #6096ba)', color: '#fff', fontSize: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' },
  createGroupBar: { padding: '15px', background: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '1px solid #eee' },
  inputSmall: { padding: '12px', border: '1px solid #ddd', borderRadius: '12px', outline: 'none', fontSize: '14px' },
  btnSmall: { padding: '10px', border: 'none', background: '#346191', color: '#fff', borderRadius: '10px', flex: 1, fontWeight: 'bold', cursor: 'pointer' }
};