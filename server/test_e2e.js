const io = require('socket.io-client');
const fetch = globalThis.fetch;

async function runTest() {
    console.log('--- Starting E2E Tests ---');
    const SERVER_URL = 'http://localhost:3000';

    try {
        // 1. Login as Admin
        console.log('1. Logging in as Admin...');
        let res = await fetch(`${SERVER_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'Admin', password: 'admin' })
        });
        const loginData = await res.json();
        if (loginData.error) throw new Error('Login failed: ' + loginData.error);
        const token = loginData.token;
        console.log('   ✅ Login successful, token received.');

        // 2. Create a Quick Persona
        console.log('2. Creating a Quick Persona...');
        const uniqueName = 'Dummy_' + Date.now().toString().slice(-4);
        res = await fetch(`${SERVER_URL}/api/operator/quick-persona`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ username: uniqueName, gender: 'male', room_slug: 'lounge-chat' })
        });
        const personaData = await res.json();
        if (personaData.error) {
            // It might fail if we already have 5 personas. That's fine, we can fetch existing ones.
            console.log('   ⚠️ Persona creation issue (maybe limit reached?):', personaData.error);
        } else {
            console.log(`   ✅ Created persona: ${uniqueName} (ID: ${personaData.id})`);
        }

        // 3. Get Personas to find one to use
        console.log('3. Fetching operator personas...');
        res = await fetch(`${SERVER_URL}/api/operator/personas`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const personas = await res.json();
        if (!personas || personas.length === 0) {
            throw new Error('No personas found for operator.');
        }
        const targetPersona = personas[0];
        console.log(`   ✅ Found persona to use: ${targetPersona.username} in room ${targetPersona.room_slug}`);

        // 4. WebSocket Test
        console.log('4. Testing WebSocket real-time messaging...');
        return new Promise((resolve, reject) => {
            const socket = io(SERVER_URL);
            
            // Timeout to fail test if no message received
            const timeout = setTimeout(() => {
                socket.disconnect();
                reject(new Error('Timeout waiting for message'));
            }, 5000);

            socket.on('connect', () => {
                console.log('   ✅ Socket connected.');
                
                // Join room
                socket.emit('join_room', { room: targetPersona.room_slug, username: 'TestAdmin', isGuest: false });
                
                // Send message as Persona
                const testMessage = `Hello from ${targetPersona.username}! (Test ID: ${Date.now()})`;
                console.log(`   ➔ Emitting send_message: "${testMessage}"`);
                
                socket.emit('send_message', {
                    room: targetPersona.room_slug,
                    username: 'TestAdmin', // base username
                    content: testMessage,
                    mediaUrl: '',
                    asPersonaId: targetPersona.id,
                    token: token
                }, (response) => {
                    if (response.error) {
                        console.error('   ❌ Send error response:', response.error);
                    } else {
                        console.log('   ✅ Server confirmed message receipt.');
                    }
                });
            });

            socket.on('new_message', (msg) => {
                console.log('   ⬅️ Received new_message event:', msg);
                if (msg.username === targetPersona.username) {
                    console.log('   ✅ SUCCESS: Message was broadcast correctly with persona identity!');
                    clearTimeout(timeout);
                    socket.disconnect();
                    resolve();
                }
            });

            socket.on('connect_error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });

    } catch (err) {
        console.error('❌ Test Failed:', err);
        process.exit(1);
    }
}

runTest().then(() => {
    console.log('--- All Tests Passed Successfully! ---');
    process.exit(0);
});
