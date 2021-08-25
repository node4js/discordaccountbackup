const token = process.argv[3];
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
var userId;
var userName;
var userAvatar;

axios({
	method: 'get',
	url: 'https://discord.com/api/v8/users/@me',
	headers: {
		'Authorization': token
	}}).then(function(response) {
		userId = response.data.id;
		userName = `${response.data.username}#${response.data.discriminator}`;
		userAvatar = response.data.avatar;
		if(process.argv[2] == 'backup') {
			console.log(`Found user to backup. Tag: ${userName}. Id: ${userId}.`);
			backupFriendsAndStart();
		} else if(process.argv[2] == 'restore') {
			console.log(`Found user to restore. Tag: ${userName}. Id: ${userId}.`);
			restoreFriendsAndStart();
		}
		
    }).catch(function(error) {
        console.log(error);
});

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function restoreFriendsAndStart() {
	const backup = fs.readFileSync('backup.txt');
	const backupFriends = backup.toString().split('--- BEGIN FRIENDS BACKUP ---\n')[1].split('\n--- END FRIENDS BACKUP ---')[0];
	var arr = backupFriends.split('\n');
	console.log(`ETA: ${arr.length * 16000}s`);
	for (var i = 0; i < arr.length; i++) {
		await sleep(16000);
		await axios({
			method: 'put',
			url: `https://discord.com/api/v8/users/@me/relationships/${arr[i]}`,
			headers: {
				'Authorization': token
			},
			data: {}
		}).then(function(response) {
			console.log(`added back friend with id: ${arr[i]}`);
		}).catch(function(error) {
			console.log(error);
		});
	}
	restoreGuilds();
}

function backupFriendsAndStart() {
	fs.writeFileSync('backup.txt', '');
    axios({
        method: 'get',
        url: 'https://discord.com/api/v8/users/@me/relationships',
        headers: {
            'Authorization': token
        }
    }).then(function(response) {
        fs.appendFileSync('backup.txt', '--- BEGIN FRIENDS BACKUP ---\n');
        for (var key in response.data) {
            if (response.data.hasOwnProperty(key)) {
                console.log(`backup: ${response.data[key]['id']} (${response.data[key]['user']['username']}#${response.data[key]['user']['discriminator']})`);
                fs.appendFileSync('backup.txt', `${response.data[key]['id']}\n`);
            }
        }
		fs.appendFileSync('backup.txt', '--- END FRIENDS BACKUP ---\n');
		backupUserData();
    }).catch(function(error) {
        console.log(error);
    });
}

async function backupUserData() {
	fs.appendFileSync('backup.txt', `--- START USERDATA BACKUP ---\nhttps://cdn.discordapp.com/avatars/${userId}/${userAvatar}.png?size=4096\n${userName.split('#')[0]}\n--- END USERDATA BACKUP ---\n`);
	backupGuilds();
}

async function restoreUserData() {
	const backup = fs.readFileSync('backup.txt');
	const backupUserData = backup.toString().split('--- START USERDATA BACKUP ---\n')[1].split('\n--- END USERDATA BACKUP ---')[0];
	var arr = backupFriends.split('\n');
	console.log(`ETA: ${arr.length * 11000}s`);
	for (var i = 0; i < arr.length; i++) {
		await sleep(11000);
		if(i == 0) {
			const writer = fs.createWriteStream('pfp.png');
			const response = await axios({
				url: arr[i],
				method: 'GET',
				responseType: 'stream'
			});
			response.data.pipe(writer);
			writer.on('finish', async function() {
				const imageb64 = fs.readFileSync('pfp.png', 'base64');
				console.log(imageb64);
				await axios({
					method: 'patch',
					url: 'https://discord.com/api/v8/users/@me',
					headers: {
						'Authorization': token
					},
					data: {avatar: `data:image/jpeg;base64,${imageb64}`}
				}).then(function(response) {
					console.log(`changed avatar`);
				}).catch(function(error) {
					console.log(error);
				});
			})
		} else {
			await axios({
					method: 'patch',
					url: 'https://discord.com/api/v8/users/@me',
					headers: {
						'Authorization': token
					},
					data: {username: arr[i]}
				}).then(function(response) {
					console.log(`changed name`);
				}).catch(function(error) {
					console.log(error);
				});
		}
	}
}

async function hasPermissionsToChannel(guildID, permissions) {
	var everyoneid;
	var roleids;
	await axios({
        method: 'get',
        url: `https://discord.com/api/v8/guilds/${guildID}`,
        headers: {
            'Authorization': token
        }
    }).then(function(response) {
		try {
			//console.log(response.data);
			for (var key in response.data.roles) {
				if(response.data.roles[key].name === '@everyone') {
					everyoneid = response.data.roles[key].id;
				}
			}
		} catch(e) {
			console.log(e);
			res = '0';
		}
    }).catch(function(error) {
        console.log(error);
    });
	await axios({
        method: 'get',
        url: `https://discord.com/api/v8/guilds/${guildID}/members/${userId}`,
        headers: {
            'Authorization': token
        }
    }).then(function(response) {
		try {
			roleids = response.data.roles;
		} catch {
			roleids = {everyoneid};
		}
    }).catch(function(error) {
        console.log(error);
    });
	for(let key = 0; key < permissions.length; key++) {
		if(roleids.includes(permissions[key].id) || everyoneid == permissions[key].id) {
			if((permissions[key].deny & 0x00000001) != 0x00000001) {
				return true;
			}
		}
	}
}

async function getGuildMainChannel(guildID) {
	var res;
	await axios({
        method: 'get',
        url: `https://discord.com/api/v8/guilds/${guildID}/channels`,
        headers: {
            'Authorization': token
        }
    }).then(async function(response) {
		try {
			for(let key = 0; key < response.data.length; key++) {
				if(response.data[key].type == 0) {
					const hasPerms = await hasPermissionsToChannel(guildID, response.data[key].permission_overwrites);
					if(hasPerms) {
						res = response.data[key].id;
						break;
					}
				}
			}
		} catch {
			res = '0';
		}
    }).catch(function(error) {
        console.log(error);
    });
	return res;
}

async function createInvite(channelID) {
	var res;
	await axios({
        method: 'post',
        url: `https://discord.com/api/v8/channels/${channelID}/invites`,
        headers: {
            'Authorization': token
        },
		data: {'max_age': 0}
    }).then(function(response) {
		try {
			res = response.data.code;
		} catch {
			res = '0';
		}
    }).catch(function(error) {
        console.log('⮩ Could not create invite.');
    });
	return res;
}

async function restoreGuilds() {
	const backup = fs.readFileSync('backup.txt');
	const backupFriends = backup.toString().split('--- BEGIN GUILDS BACKUP ---\n')[1].split('\n--- END GUILDS BACKUP ---')[0];
	var arr = backupFriends.split('\n');
	console.log(`ETA: ${arr.length * 31000}s`);
	for (var i = 0; i < arr.length; i++) {
		await axios({
			method: 'post',
			url: `https://discord.com/api/v8/invites/${arr[i].split('|')[1]}`,
			headers: {
				'Authorization': token
			},
			data: {}
		}).then(function(response) {
			console.log(`joined server with id: ${arr[i].split('|')[0]}`);
		}).catch(function(error) {
			console.log(error);
		});
		await sleep(31000);
	}
}

async function backupGuilds() {
    axios({
        method: 'get',
        url: 'https://discord.com/api/v8/users/@me/guilds',
        headers: {
            'Authorization': token
        }
    }).then(async function(response) {
        fs.appendFileSync('backup.txt', '--- BEGIN GUILDS BACKUP ---\n');
		console.log(`ETA: ${response.data.length * 3500}s`);
        for (var key in response.data) {
            if (response.data.hasOwnProperty(key)) {
                console.log(`backup: ${response.data[key]['id']} (${response.data[key]['name']})`);
				const channelID = await getGuildMainChannel(response.data[key]['id']);
				var inviteURL;
				if(channelID != 0) {
					await sleep(3500);
					inviteURL = await createInvite(channelID);
				}
				fs.appendFileSync('backup.txt', `${response.data[key]['id']}|${inviteURL||'noperms'}\n`);
            }
        }
		fs.appendFileSync('backup.txt', '--- END GUILDS BACKUP ---\n');
		backupDMs();
    }).catch(function(error) {
        console.log('internal request error');
    });
}

async function backupDMs() {
	console.log('BACKING UP DMS. THIS WILL TAKE A LONG TIME.');
	try {
		if (!fs.existsSync('dms_backup')){
			fs.mkdirSync('dms_backup');
		}
		
	    fs.readdir('dms_backup', (err, files) => {
	    	if (err) console.log(err);
	    	for (const file of files) {
	    		fs.unlink(path.join('dms_backup', file), err => {
	    			if (err) console.log(err);
	    		});
	    	}
	    });
	} catch {
	    console.log('you are do have did the funny.');
	}
	const ls = spawn('./dce/DiscordChatExporter.Cli.exe', ['exportdm', '-t', token, '-o', 'dms_backup']);
	ls.stdout.on('data', (data) => {
		console.log(`stdout: ${data}`);
	});
	ls.stderr.on('data', (data) => {
		console.error(`stderr: ${data}`);
	});
	ls.on('close', (code) => {
		console.log(`child process exited with code ${code}`);
	});
}
