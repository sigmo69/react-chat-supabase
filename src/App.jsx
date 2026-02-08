import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [groups, setGroups] = useState(['general']);
  const [activeScreen, setActiveScreen] = useState('list'); 
  const [editingMessage, setEditingMessage] = useState(null);
  
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
        setGroups([...new Set(['general', ...roomNames])]);
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
    const myName = user.user_metadata?.display_name || "User";
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
    } else {
      alert("Помилка");
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const name = user.user_metadata?.display_name || user.email;
    if (editingMessage) {
      await supabase.from('messages').update({ messages: newMessage }).eq('id', editingMessage.id);
      setEditingMessage(null);
    } else {
      await supabase.from('messages').insert([{ messages: newMessage, username: name, room_id: currentRoom }]);
    }
    setNewMessage('');
    fetchMessages();
  };

  if (!user) return (
    <div style={st.authWrapper}>
      <div style={st.loginBox}>
        <h2 style={{color: '#5085b1'}}>Telegram</h2>
        {isRegistering && <input style={st.input} placeholder="Username" onChange={e => setLogin(e.target.value)} />}
        <input style={st.input} type="email" placeholder="Email" onChange={e => setEmail(e.target.value)} />
        <input style={st.input} type="password" placeholder="Пароль" onChange={e => setPassword(e.target.value)} />
        <button onClick={async () => {
           const { error } = isRegistering 
           ? await supabase.auth.signUp({ email, password, options: { data: { display_name: login } } })
           : await supabase.auth.signInWithPassword({ email, password });
           if (error) alert(error.message);
        }} style={st.btn}>УВІЙТИ</button>
        <p onClick={() => setIsRegistering(!isRegistering)} style={st.link}>Змінити режим</p>
      </div>
    </div>
  );

  return (
    <div style={st.appFrame}>
      {activeScreen === 'list' && (
        <div style={st.screen}>
          <div style={st.header}><b>Telegram</b><button onClick={() => setIsAddingFriend(!isAddingFriend)} style={st.plusBtn}>+</button></div>
          <div style={st.content}>
            {isAddingFriend && (
              <div style={st.createGroupBar}>
                <input style={st.inputSmall} placeholder="Ім'я..." value={inputName} onChange={e => setInputName(e.target.value)} />
                <div style={{display:'flex', gap:'5px'}}>
                  <button onClick={addFriend} style={st.btnSmall}>Друг</button>
                  <button onClick={createNewGroup} style={{...st.btnSmall, background:'#4fae4e'}}>Група</button>
                </div>
              </div>
            )}
            {groups.map(g => (
              <div key={g} onClick={() => { setCurrentRoom(g); setActiveScreen('chat'); }} style={st.roomItem}>
                <div style={st.avatar}>{g.includes('&') ? '👤' : '👥'}</div>
                <div style={st.roomInfo}><div style={st.roomName}>{g}</div></div>
              </div>
            ))}
          </div>
          <div style={st.footerNav}>
            <div onClick={() => setActiveScreen('profile')} style={st.navItem}>⚙️ Профіль</div>
            <div onClick={() => supabase.auth.signOut()} style={{...st.navItem, color: 'red'}}>Вийти</div>
          </div>
        </div>
      )}

      {activeScreen === 'chat' && (
        <div style={st.screen}>
          <div style={st.header}>
            <button onClick={() => setActiveScreen('list')} style={st.backBtn}>←</button>
            <b style={{marginLeft:'10px'}}>{currentRoom}</b>
          </div>
          <div style={st.msgArea}>
            <div style={st.tgPattern}></div>
            {messages.map(m => {
              const isMine = m.username === (user.user_metadata?.display_name || user.email);
              return (
                <div key={m.id} style={{...st.bubble, alignSelf: isMine ? 'flex-end' : 'flex-start', background: isMine ? '#effdde' : '#fff'}}>
                  <div style={{fontSize:'10px', fontWeight:'bold', color: isMine ? '#4fae4e' : '#5085b1'}}>{m.username}</div>
                  <div>{m.messages}</div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={sendMessage} style={st.inputBar}>
            <input style={st.input} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Message" />
            <button type="submit" style={st.sendBtn}>➤</button>
          </form>
        </div>
      )}

      {activeScreen === 'profile' && (
        <div style={st.screen}>
          <div style={st.header}><button onClick={() => setActiveScreen('list')} style={st.backBtn}>←</button></div>
          <div style={st.profileContent}>
            <input style={st.input} value={newNickname} onChange={e => setNewNickname(e.target.value)} />
            <button onClick={async () => { await supabase.auth.updateUser({ data: { display_name: newNickname } }); setActiveScreen('list'); }} style={st.btn}>ЗБЕРЕГТИ</button>
          </div>
        </div>
      )}
    </div>
  );
}

const st = {
  appFrame: { width: '100vw', height: '100dvh', background: '#000', position: 'fixed', top: 0, left: 0, overflow: 'hidden' },
  screen: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#fff', position: 'absolute' },
  header: { padding: '10px 15px', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', paddingTop: 'env(safe-area-inset-top, 10px)' },
  content: { flex: 1, overflowY: 'auto' },
  msgArea: { flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '5px', background: '#7195ba', position: 'relative' },
  tgPattern: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' },
  inputBar: { padding: '10px', display: 'flex', background: '#fff', paddingBottom: 'env(safe-area-inset-bottom, 10px)' },
  input: { flex: 1, padding: '10px', borderRadius: '20px', border: '1px solid #ddd', outline: 'none' },
  sendBtn: { background: 'none', border: 'none', color: '#5085b1', fontSize: '24px' },
  roomItem: { display: 'flex', padding: '15px', borderBottom: '1px solid #eee', alignItems: 'center', gap: '10px' },
  avatar: { width: '40px', height: '40px', borderRadius: '50%', background: '#5085b1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  roomInfo: { flex: 1 },
  roomName: { fontWeight: 'bold' },
  plusBtn: { marginLeft: 'auto', background: 'none', border: 'none', fontSize: '24px', color: '#5085b1' },
  backBtn: { background: 'none', border: 'none', fontSize: '24px' },
  footerNav: { display: 'flex', justifyContent: 'space-around', padding: '15px', borderTop: '1px solid #eee' },
  navItem: { fontWeight: 'bold', color: '#5085b1' },
  bubble: { padding: '8px 12px', borderRadius: '12px', maxWidth: '80%', boxShadow: '0 1px 1px rgba(0,0,0,0.1)' },
  authWrapper: { display: 'flex', height: '100dvh', background: '#5085b1' },
  loginBox: { margin: 'auto', padding: '20px', background: '#fff', borderRadius: '10px', width: '260px', display: 'flex', flexDirection: 'column', gap: '10px' },
  btn: { padding: '10px', background: '#5085b1', color: '#fff', border: 'none', borderRadius: '5px' },
  link: { fontSize: '12px', textAlign: 'center', color: '#5085b1' },
  profileContent: { flex: 1, display: 'flex', flexDirection: 'column', center: 'center', justifyContent: 'center', padding: '20px', gap: '10px' },
  createGroupBar: { padding: '10px', background: '#f0f0f0', display: 'flex', flexDirection: 'column', gap: '5px' },
  inputSmall: { padding: '8px', border: '1px solid #ddd', borderRadius: '5px' },
  btnSmall: { padding: '8px', border: 'none', background: '#5085b1', color: '#fff', borderRadius: '5px', flex: 1 }
};