let spamDetection = {}; // Object to store user activity

export async function before(m, { isAdmin, isBotAdmin, command }) {
    if (m.isBaileys && m.fromMe) return true;

    let chat = global.db.data.chats[m.chat];
    let delet = m.key.participant;
    let bang = m.key.id;
    let bot = global.db.data.settings[this.user.jid] || {};
    let user = `@${m.sender.split`@`[0]}`;

    // Initialize user activity if not already present
    if (!spamDetection[m.chat]) spamDetection[m.chat] = {};
    if (!spamDetection[m.chat][m.sender]) spamDetection[m.chat][m.sender] = { count: 0, lastMessageTime: 0 };

    let now = Date.now();
    let userActivity = spamDetection[m.chat][m.sender];

    // Check if the user is spamming
    if (now - userActivity.lastMessageTime < 5000) { // 5000ms = 5 seconds
        userActivity.count += 1;
    } else {
        userActivity.count = 1;
    }

    userActivity.lastMessageTime = now;

    // Handle group chats
    if (m.isGroup) {
        if (userActivity.count > 5) { // Adjust the spam threshold as needed
            if (isBotAdmin) {
                // Get the list of admins
                let groupMetadata = await this.groupMetadata(m.chat);
                let admins = groupMetadata.participants.filter(p => p.admin !== null).map(p => p.id);

                // Notify admins about the spammer
                let adminMentions = admins.map(id => `@${id.split('@')[0]}`).join(' ');
                await this.sendMessage(m.chat, { 
                    text: `*Ops!*, \n*${user}, SPAM DETECTED AND KICKED!* \n\nAdmins: ${adminMentions}\n\nTo re-add the user, use the command .add <user>`,
                    mentions: admins
                });

                // Delete the spam message
                await this.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: bang, participant: delet } });

                // Remove the spammer
                let response = await this.groupParticipantsUpdate(m.chat, [m.sender], 'remove');
                if (response[0].status === "404") return;

            } else {
                // Bot is not an admin, just delete the spam message
                await this.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: bang }});
            }
        }
    } else { // Handle private chats
        if (userActivity.count > 3) { // Adjust the spam threshold as needed
            await this.sendMessage(m.chat, { text: `*Ops!*,\n*${user}, YOU ARE SPAMMING AND HAVE BEEN BLOCKED!*`, mentions: [m.sender] });

            // Block the user
            await this.updateBlockStatus(m.sender, 'block');

            // Delete the spam messages
            await this.sendMessage(m.chat, { delete: { remoteJid: m.chat, fromMe: false, id: bang }});
        }
    }

    // Handle the .add command to re-add users
    if (command === '.add') {
        if (!isAdmin) return; // Only admins should be able to use this command

        let args = m.text.split(' ');
        if (args.length !== 2) return;

        let userToAdd = args[1];
        try {
            await this.groupParticipantsUpdate(m.chat, [userToAdd], 'add');
            await this.sendMessage(m.chat, { text: `*${userToAdd}* has been re-added to the group.`, mentions: [userToAdd] });
        } catch (e) {
            await this.sendMessage(m.chat, { text: `Failed to re-add *${userToAdd}*.`, mentions: [userToAdd] });
        }
    }

    return true;
}
