import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeScreen, setActiveScreen] = useState('list'); 
  const [currentRoom, setCurrentRoom] = useState('Загальний');
  const [rooms, setRooms] = useState(['Загальний']);
  
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const messagesEndRef = useRef(null);
  const lastMessageId = useRef(null); // Для відстеження нових повідомлень

  useEffect(() => {
    // Запит дозволу на сповіщення при завантаженні
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user);
        fetchRooms();
      }
    });
    
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const loadProfile = (u) => {
    setNickname(u.user_metadata?.nickname || u.email.split('@')[0]);
    setAvatarUrl(u.user_metadata?.avatar_url || null);
  };

  const fetchRooms = async () => {
    const { data } = await supabase.from('rooms').select('name');
    if (data) setRooms(['Загальний', ...data.map(r => r.name)]);
  };

  // Логіка отримання повідомлень та сповіщень
  useEffect(() => {
    if (user) {
      const fetchMsgs = async () => {
        const { data } = await supabase.from('messages')
          .select('*').eq('room_id', currentRoom).order('created_at', { ascending: true });
        
        if (data && data.length > 0) {
          const latest = data[data.length - 1];
          
          // Якщо прийшло нове повідомлення НЕ від нас
          if (lastMessageId.current && latest.id !== lastMessageId.current && latest.user_id !== user.id) {
            showNotification(latest.username, latest.messages);
          }
          
          lastMessageId.current = latest.id;
          setMessages(data);
        }
      };

      fetchMsgs();
      const interval = setInterval(fetchMsgs, 3000);
      return () => clearInterval(interval);
    }
  }, [user, currentRoom, activeScreen]);

  const showNotification = (sender, text) => {
    if (Notification.permission === "granted") {
      new Notification(`Нове повідомлення від ${sender}`, {
        body: text,
        icon: 'https://cdn-icons-png.flaticon.com/512/733/733585.png' // Можна замінити на свій логотип
      });
      // Додаємо звук
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
      audio.play();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAuth = async () => {
    try {
      if (isRegistering) {
        await supabase.auth.signUp({ email, password, options: { data: { nickname: email.split('@')[0] } } });
        alert("Реєстрація успішна!");
        setIsRegistering(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) { alert(e.message); }
  };

  const createRoom = async () => {
    const name = prompt("Назва групи:");
    if (name) {
      await supabase.from('rooms').insert([{ name }]);
      fetchRooms();
    }
  };

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    if (editingId) {
      await supabase.from('messages').update({ messages: newMessage }).eq('id', editingId);
      setEditingId(null);
    } else {
      await supabase.from('messages').insert([{ 
        messages: newMessage, username: nickname, user_id: user.id, room_id: currentRoom, avatar_url: avatarUrl
      }]);
    }
    setNewMessage('');
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files[0];
    const fileName = `${user.id}-${Date.now()}`;
    await supabase.storage.from('avatars').upload(fileName, file);
    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    setAvatarUrl(data.publicUrl);
  };

  if (!user) return (
    <div style={st.authPage}>
      <div style={st.logo}>M</div>
      <input style={st.input} placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <input style={st.input} type="password" placeholder="Пароль" onChange={e => setPassword(e.target.value)} />
      <button style={st.btn} onClick={handleAuth}>{isRegistering ? 'СТВОРИТИ' : 'УВІЙТИ'}</button>
      <p onClick={() => setIsRegistering(!isRegistering)} style={{cursor:'pointer'}}>{isRegistering ? 'Назад' : 'Реєстрація'}</p>
    </div>
  );

  return (
    <div style={st.container}>
      <div style={st.header}>
        <span onClick={() => setActiveScreen('profile')} style={st.hIcon}>👤 Профіль</span>
        <b>{activeScreen === 'chat' ? currentRoom : 'Mova'}</b>
        <span onClick={createRoom} style={st.hIcon}>➕ Група</span>
      </div>

      <div style={{flex: 1, overflowY: 'auto'}}>
        {activeScreen === 'list' && (
          <div style={{padding: '10px'}}>
            {rooms.map(r => (
              <div key={r} onClick={() => {setCurrentRoom(r); setActiveScreen('chat');}} style={st.roomItem}>
                <div style={st.avatarSmall}>{r[0].toUpperCase()}</div>
                <b>{r}</b>
              </div>
            ))}
          </div>
        )}

        {activeScreen === 'chat' && (
          <div style={st.chatContainer}>
            <div onClick={() => setActiveScreen('list')} style={st.backBtn}>← Назад</div>
            <div style={st.msgList}>
              {messages.map(m => (
                <div key={m.id} style={{...st.row, flexDirection: m.user_id === user.id ? 'row-reverse' : 'row'}}>
                  <img src={m.avatar_url || 'https://via.placeholder.com/30'} style={st.imgAvatar} />
                  <div style={{...st.bubble, background: m.user_id === user.id ? '#000' : '#f0f0f0', color: m.user_id === user.id ? '#fff' : '#000'}}>
                    <div style={{fontSize:'10px', opacity:0.6}}>{m.username}</div>
                    <div>{m.messages}</div>
                    {m.user_id === user.id && (
                      <div style={st.actions}>
                        <span onClick={() => {setEditingId(m.id); setNewMessage(m.messages)}}>✏️</span>
                        <span onClick={async () => await supabase.from('messages').delete().eq('id', m.id)}>🗑️</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMsg} style={st.inputBar}>
              <input style={st.msgInput} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Повідомлення..." />
              <button type="submit" style={st.sendBtn}>{editingId ? '✅' : '➤'}</button>
            </form>
          </div>
        )}

        {activeScreen === 'profile' && (
          <div style={st.profilePage}>
             <img src={avatarUrl || 'https://via.placeholder.com/100'} style={st.bigAvatar} />
             <input type="file" onChange={uploadAvatar} />
             <input style={st.input} value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Нікнейм" />
             <button style={st.btn} onClick={async () => {
               await supabase.auth.updateUser({ data: { nickname, avatar_url: avatarUrl } });
               alert("Оновлено!");
             }}>ЗБЕРЕГТИ</button>
             <button style={{...st.btn, background:'red'}} onClick={() => supabase.auth.signOut()}>ВИЙТИ</button>
             <button onClick={() => setActiveScreen('list')}>НАЗАД</button>
          </div>
        )}
      </div>
    </div>
  );
}

const st = {
  container: { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#fff', fontFamily: 'sans-serif' },
  header: { padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  hIcon: { fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' },
  authPage: { display: 'flex', flexDirection: 'column', height: '100dvh', alignItems: 'center', justifyContent: 'center', gap: '15px' },
  logo: { width: '80px', height: '80px', background: '#000', color: '#fff', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', fontWeight: 'bold' },
  input: { padding: '12px', border: '1px solid #000', borderRadius: '10px', width: '250px' },
  btn: { padding: '12px 30px', background: '#000', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' },
  roomItem: { padding: '15px', borderBottom: '1px solid #f9f9f9', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' },
  avatarSmall: { width: '40px', height: '40px', background: '#000', color: '#fff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  chatContainer: { display: 'flex', flexDirection: 'column', height: '100%' },
  backBtn: { padding: '10px', background: '#f5f5f5', fontSize: '12px', cursor: 'pointer' },
  msgList: { flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' },
  row: { display: 'flex', gap: '10px', alignItems: 'flex-end' },
  imgAvatar: { width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' },
  bubble: { padding: '10px', borderRadius: '12px', maxWidth: '75%' },
  actions: { display: 'flex', gap: '8px', marginTop: '4px', cursor: 'pointer' },
  inputBar: { padding: '15px', borderTop: '1px solid #eee', display: 'flex', gap: '10px' },
  msgInput: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #000' },
  sendBtn: { border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer' },
  profilePage: { padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' },
  bigAvatar: { width: '100px', height: '100px', borderRadius: '25px', objectFit: 'cover' }
};