import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabaseClient';

export default function App() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [activeScreen, setActiveScreen] = useState('list'); 
  const [currentRoom, setCurrentRoom] = useState('Загальний');
  
  // Дані користувача
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadProfile(session.user);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const loadProfile = (user) => {
    setNickname(user.user_metadata?.nickname || user.email.split('@')[0]);
    setAvatarUrl(user.user_metadata?.avatar_url || null);
  };

  useEffect(() => {
    if (user && activeScreen === 'chat') {
      const fetchMsgs = async () => {
        const { data } = await supabase.from('messages')
          .select('*')
          .eq('room_id', currentRoom)
          .order('created_at', { ascending: true });
        if (data) setMessages(data);
      };
      fetchMsgs();
      const interval = setInterval(fetchMsgs, 2000);
      return () => clearInterval(interval);
    }
  }, [user, activeScreen, currentRoom]);

  const handleAuth = async () => {
    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({ 
          email, password, 
          options: { data: { nickname: email.split('@')[0] } } 
        });
        if (error) throw error;
        alert("Реєстрація успішна! Увійдіть.");
        setIsRegistering(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e) { alert(e.message); }
  };

  const updateProfile = async () => {
    const { error } = await supabase.auth.updateUser({
      data: { nickname: nickname, avatar_url: avatarUrl }
    });
    if (error) alert(error.message);
    else alert("Профіль оновлено!");
  };

  const uploadAvatar = async (e) => {
    try {
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      let { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
    } catch (e) { alert("Помилка завантаження: " + e.message); }
  };

  const sendMsg = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    await supabase.from('messages').insert([{ 
      messages: newMessage, 
      username: nickname, 
      user_id: user.id,
      room_id: currentRoom,
      avatar_url: avatarUrl
    }]);
    setNewMessage('');
  };

  if (!user) return (
    <div style={st.authPage}>
      <div style={st.logo}>M</div>
      <h2 style={{color: '#000'}}>Mova</h2>
      <input style={st.input} placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <input style={st.input} type="password" placeholder="Пароль" onChange={e => setPassword(e.target.value)} />
      <button style={st.btn} onClick={handleAuth}>{isRegistering ? 'ЗАРЕЄСТРУВАТИСЯ' : 'УВІЙТИ'}</button>
      <p onClick={() => setIsRegistering(!isRegistering)} style={{cursor:'pointer', fontWeight:'bold'}}>
        {isRegistering ? 'Вже є акаунт? Увійти' : 'Немає акаунту? Створити'}
      </p>
    </div>
  );

  return (
    <div style={st.container}>
      <div style={st.header}>
        <span onClick={() => setActiveScreen('profile')} style={{cursor:'pointer'}}>👤 Профіль</span>
        <b>{activeScreen === 'chat' ? currentRoom : 'Mova'}</b>
        <span onClick={() => setActiveScreen('list')} style={{cursor:'pointer'}}>💬 Чати</span>
      </div>

      <div style={{flex: 1, overflowY: 'auto'}}>
        {activeScreen === 'list' && (
          <div style={{padding: '10px'}}>
            <div onClick={() => {setCurrentRoom('Загальний'); setActiveScreen('chat');}} style={st.item}>
              <div style={st.avatarSmall}>#</div>
              <b>Загальний чат</b>
            </div>
          </div>
        )}

        {activeScreen === 'chat' && (
          <div style={st.chatWrap}>
            <div style={st.msgList}>
              {messages.map(m => (
                <div key={m.id} style={{...st.row, flexDirection: m.user_id === user.id ? 'row-reverse' : 'row'}}>
                  <img src={m.avatar_url || 'https://via.placeholder.com/30'} style={st.imgAvatar} />
                  <div style={{...st.bubble, background: m.user_id === user.id ? '#000' : '#f0f0f0', color: m.user_id === user.id ? '#fff' : '#000'}}>
                    <div style={{fontSize:'10px', opacity:0.6}}>{m.username}</div>
                    {m.messages}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMsg} style={st.inputArea}>
              <input style={st.msgInput} value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Повідомлення..." />
              <button type="submit" style={st.sendBtn}>➤</button>
            </form>
          </div>
        )}

        {activeScreen === 'profile' && (
          <div style={st.profilePage}>
            <div style={{position: 'relative'}}>
              <img src={avatarUrl || 'https://via.placeholder.com/100'} style={st.bigAvatar} />
              <label style={st.uploadBtn}>
                📷 <input type="file" hidden onChange={uploadAvatar} />
              </label>
            </div>
            <input style={st.input} value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Твій нікнейм" />
            <button style={st.btn} onClick={updateProfile}>ЗБЕРЕГТИ ЗМІНИ</button>
            <button style={{...st.btn, background:'red'}} onClick={() => supabase.auth.signOut()}>ВИЙТИ</button>
          </div>
        )}
      </div>
    </div>
  );
}

const st = {
  container: { display: 'flex', flexDirection: 'column', height: '100dvh', background: '#fff', fontFamily: 'sans-serif' },
  authPage: { display: 'flex', flexDirection: 'column', height: '100dvh', alignItems: 'center', justifyContent: 'center', gap: '15px' },
  logo: { width: '80px', height: '80px', background: '#000', color: '#fff', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', fontWeight: 'bold' },
  input: { padding: '12px', border: '1px solid #000', borderRadius: '10px', width: '260px', outline: 'none' },
  btn: { padding: '12px 30px', background: '#000', color: '#fff', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' },
  header: { padding: '15px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  item: { padding: '15px', borderBottom: '1px solid #f9f9f9', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer' },
  avatarSmall: { width: '40px', height: '40px', background: '#000', color: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  chatWrap: { display: 'flex', flexDirection: 'column', height: '100%' },
  msgList: { flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' },
  row: { display: 'flex', gap: '10px', alignItems: 'flex-end' },
  imgAvatar: { width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' },
  bubble: { padding: '10px', borderRadius: '12px', maxWidth: '75%' },
  inputArea: { padding: '15px', borderTop: '1px solid #eee', display: 'flex', gap: '10px' },
  msgInput: { flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #000' },
  sendBtn: { border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer' },
  profilePage: { padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' },
  bigAvatar: { width: '120px', height: '120px', borderRadius: '30px', objectFit: 'cover', background: '#eee' },
  uploadBtn: { position: 'absolute', bottom: '0', right: '0', background: '#fff', border: '1px solid #000', borderRadius: '50%', width: '35px', height: '35px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }
};