// ============================================================
// Supabase configuration
// ============================================================

const SUPABASE_URL = 'https://vrxsoryywjufluhiilsz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tvZe7CxY48kALmj3-GHZ2g_F3GKyQ0n';

const offlineMode = !navigator.onLine || !window.supabase;

function offlineUsers() {
    return JSON.parse(localStorage.getItem('felixz-offline-users') || '{}');
}

function saveOfflineUsers(users) {
    localStorage.setItem('felixz-offline-users', JSON.stringify(users));
}

function offlineRows(table) {
    return JSON.parse(localStorage.getItem(`felixz-offline-${table}`) || '[]');
}

function saveOfflineRows(table, rows) {
    localStorage.setItem(`felixz-offline-${table}`, JSON.stringify(rows));
}

function createOfflineQuery(table, operation = 'select', values = null) {
    const query = {
        filters: [],
        operation,
        values,
        eq(column, value) {
            this.filters.push([column, value]);
            return this;
        },
        select() {
            this.operation = 'select';
            return this;
        },
        order() {
            return this;
        },
        limit() {
            return this;
        },
        single() {
            this.singleResult = true;
            return this;
        },
        then(resolve) {
            let rows = offlineRows(table);
            rows = rows.filter((row) => this.filters.every(([column, value]) => row[column] === value));

            if (this.operation === 'update') {
                rows.forEach((row) => Object.assign(row, this.values));
                saveOfflineRows(table, offlineRows(table).map((row) => rows.includes(row) ? row : row));
            }

            if (this.operation === 'insert') {
                const nextRows = offlineRows(table);
                nextRows.push(this.values);
                saveOfflineRows(table, nextRows);
                rows = [this.values];
            }

            if (this.operation === 'upsert') {
                const nextRows = offlineRows(table);
                const existing = nextRows.find((row) => row.game_code === this.values.game_code && row.user_id === this.values.user_id);
                if (existing) Object.assign(existing, this.values);
                else nextRows.push(this.values);
                saveOfflineRows(table, nextRows);
                rows = [this.values];
            }

            const data = this.singleResult ? (rows[0] || null) : rows;
            return Promise.resolve(resolve({ data, error: this.singleResult && !data ? { message: 'Offline record not found' } : null }));
        }
    };

    return query;
}

function createOfflineDb() {
    return {
        from(table) {
            return {
                select: () => createOfflineQuery(table),
                update: (values) => createOfflineQuery(table, 'update', values),
                insert: (values) => createOfflineQuery(table, 'insert', values),
                upsert: (values) => createOfflineQuery(table, 'upsert', values)
            };
        },
        channel() {
            return { on() { return this; }, subscribe() { return this; } };
        },
        removeChannel() {},
        auth: {
            async signUp({ email, password, options }) {
                const users = offlineUsers();
                if (users[email]) return { data: {}, error: { message: 'That email is already registered.' } };
                const id = `offline-${Date.now()}`;
                users[email] = { id, email, password, username: options.data.username };
                saveOfflineUsers(users);
                localStorage.setItem('felixz-offline-session', email);
                return { data: { session: { user: users[email] }, user: users[email] }, error: null };
            },
            async signInWithPassword({ email, password }) {
                const account = offlineUsers()[email];
                if (!account || account.password !== password) return { data: {}, error: { message: 'Incorrect email or password.' } };
                localStorage.setItem('felixz-offline-session', email);
                return { data: { session: { user: account }, user: account }, error: null };
            },
            async signOut() {
                localStorage.removeItem('felixz-offline-session');
            },
            async getSession() {
                const account = offlineUsers()[localStorage.getItem('felixz-offline-session')];
                return { data: { session: account ? { user: account } : null }, error: null };
            }
        }
    };
}

const db = offlineMode ? createOfflineDb() : window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (selector) => document.querySelector(selector);

// ============================================================
// Game data
// ============================================================

const icon = {
    star: '\u{2B50}',
    meadow: '\u{1F33F}',
    party: '\u{1F389}',
    space: '\u{1F680}',
    frog: '\u{1F438}',
    bee: '\u{1F41D}',
    fox: '\u{1F98A}',
    dog: '\u{1F436}',
    penguin: '\u{1F427}',
    axolotl: '\u{1F98E}',
    alien: '\u{1F47D}',
    robot: '\u{1F916}',
    astronaut: '\u{1F468}\u200D\u{1F680}'
};

const questions = {
    quick: [
        ['What is 7 x 3?', ['21', '24', '18', '27'], '21'],
        ['Which planet is red?', ['Venus', 'Mars', 'Jupiter', 'Saturn'], 'Mars'],
        ['How many sides does a hexagon have?', ['5', '6', '8', '10'], '6']
    ],
    science: [
        ['What do plants need for photosynthesis?', ['Light', 'Metal', 'Sand', 'Ice'], 'Light'],
        ['What is Earth natural satellite?', ['The Sun', 'The Moon', 'Mars', 'Venus'], 'The Moon'],
        ['Which animal is a mammal?', ['Shark', 'Frog', 'Dolphin', 'Turtle'], 'Dolphin']
    ],
    world: [
        ['What is the capital of France?', ['Rome', 'Madrid', 'Paris', 'Lisbon'], 'Paris'],
        ['Which continent is Egypt in?', ['Asia', 'Africa', 'Europe', 'Oceania'], 'Africa'],
        ['Which country is shaped like a boot?', ['Italy', 'Chile', 'India', 'Greece'], 'Italy']
    ],
    streak: [
        ['What is 12 x 8?', ['86', '96', '108', '88'], '96'],
        ['Which element has the symbol O?', ['Gold', 'Oxygen', 'Osmium', 'Iron'], 'Oxygen'],
        ['What is the square root of 144?', ['10', '11', '12', '14'], '12']
    ],
    speed: [
        ['What is 9 + 6?', ['12', '14', '15', '16'], '15'],
        ['Which shape has three sides?', ['Square', 'Circle', 'Triangle', 'Oval'], 'Triangle'],
        ['How many days are in a week?', ['5', '6', '7', '8'], '7']
    ]
};

const modes = {
    quick: [10, 'Quick play'],
    science: [15, 'Curious science'],
    world: [15, 'World tour'],
    streak: [25, 'Streak master'],
    speed: [20, 'Speed run']
};

const packs = [
    [
        'Meadow Pack',
        20,
        icon.meadow,
        [
            ['Green Kitty', icon.frog, 'Common'],
            ['Honey Bee', icon.bee, 'Common'],
            ['Little Fox', icon.fox, 'Rare']
        ]
    ],
    [
        'Party Pack',
        30,
        icon.party,
        [
            ['Balloon Pup', icon.dog, 'Common'],
            ['DJ Penguin', icon.penguin, 'Rare'],
            ['Disco Axolotl', icon.axolotl, 'Epic']
        ]
    ],
    [
        'Cosmos Pack',
        50,
        icon.space,
        [
            ['Friendly Alien', icon.alien, 'Rare'],
            ['Moon Robot', icon.robot, 'Epic'],
            ['Astronaut', icon.astronaut, 'Legendary']
        ]
    ]
];

// ============================================================
// Application state and profile helpers
// ============================================================

let user = null;
let profile = null;
let authMode = 'login';
let activeGame = null;
let gameChannel = null;
let chatChannel = null;

const gameState = {
    mode: 'quick',
    index: 0
};

const blankProfile = (id, username) => ({
    id,
    username,
    coins: 0,
    streak: 0,
    best_streak: 0,
    equipped_blook: {
        name: 'Starter Blook',
        icon: icon.star,
        rarity: 'Common'
    },
    collection: [
        {
            name: 'Starter Blook',
            icon: icon.star,
            rarity: 'Common'
        }
    ],
    stats: {
        gamesPlayed: 0,
        questionsAnswered: 0,
        correctAnswers: 0,
        coinsEarned: 0,
        packsOpened: 0,
        modes: {}
    }
});

function toast(message) {
    const item = document.createElement('div');
    item.className = 'toast';
    item.textContent = message;
    document.body.append(item);
    setTimeout(() => item.remove(), 2500);
}

function applyProfile() {
    $('#player-name').textContent = profile.username;
    $('#coin-count').textContent = profile.coins;
    $('#streak-count').textContent = profile.streak;
    $('#profile-blook').textContent = profile.equipped_blook.icon;
    $('#profile-badge').textContent = `${profile.equipped_blook.rarity} blook`;
}

async function saveProfile() {
    const { error } = await db
        .from('profiles')
        .update({
            coins: profile.coins,
            streak: profile.streak,
            best_streak: profile.best_streak,
            equipped_blook: profile.equipped_blook,
            collection: profile.collection,
            stats: profile.stats,
            updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

    if (error) {
        toast('Could not save progress. Check your database schema.');
    }
}

async function loadProfile() {
    if (offlineMode) {
        const rows = offlineRows('profiles');
        profile = rows.find((row) => row.id === user.id);

        if (!profile) {
            profile = blankProfile(user.id, user.username);
            rows.push(profile);
            saveOfflineRows('profiles', rows);
        }

        applyProfile();
        drawLocker();
        drawStats();
        drawChat();
        return;
    }

    const { data, error } = await db
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
        toast('Run supabase-schema.sql in your project first.');
        throw error;
    }

    profile = data;
    applyProfile();
    drawLocker();
    drawStats();
    drawChat();
}

// ============================================================
// Navigation and authentication
// ============================================================

function showView(name) {
    document.querySelectorAll('.view').forEach((view) => {
        view.classList.toggle('active', view.id === `${name}-view`);
    });

    if (name === 'packs') drawPacks();
    if (name === 'collection') drawLocker();
    if (name === 'stats') drawStats();
    if (name === 'games') drawGames();
}

async function handleAuth(event) {
    event.preventDefault();

    const email = $('#email').value.trim();
    const username = $('#username').value.trim();
    const password = $('#password').value;
    const result = authMode === 'register'
        ? await db.auth.signUp({
            email,
            password,
            options: { data: { username } }
        })
        : await db.auth.signInWithPassword({ email, password });

    if (result.error) {
        $('#auth-note').textContent = result.error.message;
        return;
    }

    if (authMode === 'register' && !result.data.session) {
        $('#auth-note').textContent = 'Check your email to confirm your account, then sign in.';
        return;
    }

    user = result.data.user;
    await loadProfile();
    $('#auth-screen').classList.add('hidden');
    $('#game-app').classList.remove('hidden');
}

// ============================================================
// Quiz gameplay
// ============================================================

function startLocalQuiz(mode) {
    gameState.mode = mode;
    gameState.index = 0;
    $('#quiz-mode').textContent = modes[mode][1];
    $('#reward-count').textContent = modes[mode][0];
    showView('quiz');
    renderQuestion();
}

function renderQuestion() {
    const item = questions[gameState.mode][gameState.index];

    $('#question-number').textContent =
        `Question ${gameState.index + 1} of ${questions[gameState.mode].length}`;
    $('#question-text').textContent = item[0];
    $('#answers').innerHTML = item[1]
        .map((answer) => `<button class="answer">${answer}</button>`)
        .join('');
    $('#feedback').textContent = '';

    document.querySelectorAll('.answer').forEach((button) => {
        button.onclick = () => answerQuestion(button, item[2]);
    });
}

async function answerQuestion(button, correct) {
    if (document.querySelector('.answer[disabled]')) return;

    document.querySelectorAll('.answer').forEach((answer) => {
        answer.disabled = true;
        if (answer.textContent === correct) answer.classList.add('correct');
    });

    const stats = profile.stats || blankProfile(user.id, profile.username).stats;
    stats.questionsAnswered = (stats.questionsAnswered || 0) + 1;
    stats.modes = stats.modes || {};
    stats.modes[gameState.mode] = stats.modes[gameState.mode] || {
        correct: 0,
        total: 0
    };
    stats.modes[gameState.mode].total += 1;

    if (button && button.textContent === correct) {
        const reward = modes[gameState.mode][0];
        profile.coins += reward;
        profile.streak += 1;
        profile.best_streak = Math.max(profile.best_streak, profile.streak);
        stats.correctAnswers = (stats.correctAnswers || 0) + 1;
        stats.coinsEarned = (stats.coinsEarned || 0) + reward;
        stats.modes[gameState.mode].correct += 1;
        $('#feedback').textContent = `Correct! +${reward} coins`;
    } else {
        profile.streak = 0;
        if (button) button.classList.add('wrong');
        $('#feedback').textContent = `Almost. The answer was ${correct}.`;
    }

    profile.stats = stats;
    applyProfile();
    await saveProfile();

    setTimeout(() => {
        gameState.index += 1;

        if (gameState.index < questions[gameState.mode].length) {
            renderQuestion();
        } else {
            toast('Game complete!');
            showView('home');
        }
    }, 700);
}

// ============================================================
// Packs and locker
// ============================================================

function drawPacks() {
    $('#pack-grid').innerHTML = packs
        .map((pack, index) => `
            <article class="pack-card">
                <div>
                    <div class="pack-art">${pack[2]}</div>
                    <h3>${pack[0]}</h3>
                    <p>Three surprise blooks for your locker.</p>
                </div>
                <button class="primary" data-pack="${index}" ${profile.coins < pack[1] ? 'disabled' : ''}>
                    Open for ${pack[1]}
                </button>
            </article>
        `)
        .join('');

    document.querySelectorAll('[data-pack]').forEach((button) => {
        button.onclick = () => openPack(Number(button.dataset.pack));
    });
}

async function openPack(index) {
    const pack = packs[index];
    if (profile.coins < pack[1]) return;

    profile.coins -= pack[1];
    profile.stats.packsOpened = (profile.stats.packsOpened || 0) + 1;

    const blook = pack[3][Math.floor(Math.random() * pack[3].length)];
    if (!profile.collection.some((item) => item.name === blook[0])) {
        profile.collection.push({
            name: blook[0],
            icon: blook[1],
            rarity: blook[2]
        });
    }

    applyProfile();
    await saveProfile();
    drawPacks();

    const modal = document.createElement('div');
    modal.className = 'pack-reveal';
    modal.innerHTML = `
        <div class="reveal-card">
            <div class="reveal-blook">${blook[1]}</div>
            <h2>${blook[0]}</h2>
            <p>${blook[2]} blook added to your locker</p>
            <button class="secondary">Awesome!</button>
        </div>
    `;
    document.body.append(modal);
    modal.querySelector('button').onclick = () => modal.remove();
}

function drawLocker() {
    $('#locker-hero').innerHTML = `
        <div class="avatar-stage">${profile.equipped_blook.icon}</div>
        <div>
            <div class="equipped-label">Currently equipped</div>
            <h2>${profile.equipped_blook.name}</h2>
            <p>Your profile blook represents you in the locker.</p>
        </div>
    `;

    $('#collection-grid').innerHTML = profile.collection
        .map((blook, index) => `
            <article class="collection-item">
                <div class="blook">${blook.icon}</div>
                <div class="rarity">${blook.rarity}</div>
                <h3>${blook.name}</h3>
                <button class="equip-button" data-equip="${index}">
                    ${blook.name === profile.equipped_blook.name ? 'Equipped' : 'Equip blook'}
                </button>
            </article>
        `)
        .join('');

    document.querySelectorAll('[data-equip]').forEach((button) => {
        button.onclick = async () => {
            profile.equipped_blook = profile.collection[Number(button.dataset.equip)];
            applyProfile();
            drawLocker();
            await saveProfile();
            toast('Blook equipped!');
        };
    });
}

// ============================================================
// Stats and global chat
// ============================================================

function drawStats() {
    const stats = profile.stats || {};
    const accuracy = stats.questionsAnswered
        ? Math.round((stats.correctAnswers || 0) / stats.questionsAnswered * 100)
        : 0;

    $('#stats-grid').innerHTML = [
        ['Games played', stats.gamesPlayed || 0],
        ['Questions answered', stats.questionsAnswered || 0],
        ['Accuracy', `${accuracy}%`],
        ['Coins earned', stats.coinsEarned || 0],
        ['Best streak', profile.best_streak],
        ['Packs opened', stats.packsOpened || 0]
    ]
        .map(([label, value]) => `
            <article class="stat-card">
                <span class="stat-label">${label}</span>
                <strong class="stat-value">${value}</strong>
            </article>
        `)
        .join('');
}

function drawChat() {
    if (chatChannel) db.removeChannel(chatChannel);

    chatChannel = db
        .channel('global-chat')
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'chat_messages' },
            (payload) => appendMessage(payload.new)
        )
        .subscribe();

    db.from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100)
        .then(({ data }) => {
            $('#messages').innerHTML = '';
            (data || []).forEach(appendMessage);
        });
}

function appendMessage(message) {
    const item = document.createElement('div');
    item.className = `message ${message.user_id === user.id ? 'mine' : ''}`;
    item.innerHTML = `<strong>${message.username}</strong><p>${message.message}</p>`;
    $('#messages').append(item);
    $('#messages').scrollTop = $('#messages').scrollHeight;
}

async function sendMessage(event) {
    event.preventDefault();

    const input = $('#chat-input');
    const message = input.value.trim();
    if (!message) return;

    const { error } = await db.from('chat_messages').insert({
        user_id: user.id,
        username: profile.username,
        message
    });

    if (error) toast(error.message);
    input.value = '';
}

// ============================================================
// Multiplayer games
// ============================================================

function randomCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function drawGames() {
    if (!activeGame) return;
    $('#active-game-code').textContent = activeGame.code;
    $('#game-lobby').classList.remove('hidden');
    refreshPlayers(activeGame.code);
}

async function createGame() {
    const code = randomCode();
    const { error } = await db.from('games').insert({
        code,
        host_id: user.id,
        mode: 'quick'
    });

    if (error) {
        toast(error.message);
        return;
    }

    await joinGame(code);
}

async function joinGame(code) {
    code = code.trim().toUpperCase();

    const { data: game, error } = await db
        .from('games')
        .select('*')
        .eq('code', code)
        .single();

    if (error || !game) {
        toast('Game not found. Check the code.');
        return;
    }

    const { error: joinError } = await db.from('game_players').upsert(
        {
            game_code: code,
            user_id: user.id,
            username: profile.username
        },
        { onConflict: 'game_code,user_id' }
    );

    if (joinError) {
        toast(joinError.message);
        return;
    }

    activeGame = game;
    $('#active-game-code').textContent = code;
    $('#game-lobby').classList.remove('hidden');
    subscribeGame(code);
    refreshPlayers(code);
}

function subscribeGame(code) {
    if (gameChannel) db.removeChannel(gameChannel);

    gameChannel = db
        .channel(`game-${code}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'game_players',
                filter: `game_code=eq.${code}`
            },
            () => refreshPlayers(code)
        )
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'games',
                filter: `code=eq.${code}`
            },
            (payload) => {
                activeGame = payload.new;
                if (payload.new.status === 'playing') {
                    startLocalQuiz(payload.new.mode);
                }
            }
        )
        .subscribe();
}

async function refreshPlayers(code) {
    const { data } = await db
        .from('game_players')
        .select('*')
        .eq('game_code', code);

    $('#game-players').innerHTML = (data || [])
        .map((player) => `
            <div class="message">
                <strong>${player.username}</strong>
                <p>${player.ready ? 'Ready' : 'In lobby'}</p>
            </div>
        `)
        .join('') || '<div class="empty">Waiting for players...</div>';
}

async function startGameForEveryone() {
    if (!activeGame || activeGame.host_id !== user.id) return;

    const { error } = await db
        .from('games')
        .update({ status: 'playing' })
        .eq('code', activeGame.code)
        .eq('host_id', user.id);

    if (error) {
        toast(error.message);
        return;
    }

    startLocalQuiz(activeGame.mode);
}

// ============================================================
// Event wiring and session restore
// ============================================================

document.querySelectorAll('.auth-tabs button').forEach((button) => {
    button.onclick = () => {
        authMode = button.dataset.auth;
        document.querySelectorAll('.auth-tabs button').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.auth === authMode);
        });
        $('#auth-submit').textContent = authMode === 'login' ? 'Sign in' : 'Create account';
    };
});

if (offlineMode) {
    const offlineNotice = document.createElement('div');
    offlineNotice.className = 'toast';
    offlineNotice.textContent = 'Offline mode: progress is saved on this device.';
    document.body.append(offlineNotice);
    setTimeout(() => offlineNotice.remove(), 4000);
}

$('#auth-form').onsubmit = handleAuth;

document.querySelectorAll('.nav [data-view]').forEach((button) => {
    button.onclick = () => showView(button.dataset.view);
});

document.querySelectorAll('.mode-card').forEach((button) => {
    button.onclick = () => startLocalQuiz(button.dataset.mode);
});

$('#logout-button').onclick = async () => {
    await db.auth.signOut();
    location.reload();
};

$('#chat-form').onsubmit = sendMessage;
$('#create-game').onclick = createGame;

$('#join-game-form').onsubmit = (event) => {
    event.preventDefault();
    joinGame($('#game-code-input').value);
};

$('#start-game').onclick = startGameForEveryone;

db.auth.getSession().then(async ({ data }) => {
    if (!data.session) return;

    user = data.session.user;
    await loadProfile();
    $('#auth-screen').classList.add('hidden');
    $('#game-app').classList.remove('hidden');
});

window.addEventListener('offline', () => {
    toast('Connection lost. Switching to offline mode.');
    setTimeout(() => location.reload(), 700);
});

window.addEventListener('online', () => {
    toast('Connection restored.');
});
