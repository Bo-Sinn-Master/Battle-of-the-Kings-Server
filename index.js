const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const WebSocket = require('ws');
const http = require('http');

dotenv.config();
const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 8081;

app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173', 'https://battle-of-the-kings-client.vercel.app', 'https://battle-of-the-kings-server.onrender.com'] }));
app.use(express.json());

const users = new Map();

const wss = new WebSocket.Server({ server });
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  ws.on('message', (message) => {
    try {
      const { user_id, action } = JSON.parse(message);
      console.log(`Received message: user_id=${user_id}, action=${action}`);
      if (action === 'pvp_match') {
        ws.send(JSON.stringify({ status: 'success', match: `vs Player${user_id + 1}` }));
      } else {
        ws.send(JSON.stringify({ status: 'error', message: 'Unknown action' }));
      }
    } catch (err) {
      console.error('WebSocket message error:', err.message);
      ws.send(JSON.stringify({ status: 'error', message: 'Invalid message format' }));
    }
  });
  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
  ws.on('close', (code, reason) => {
    console.log(`WebSocket closed: code=${code}, reason=${reason}`);
  });
});

app.post('/api', async (req, res) => {
  const { user_id, action, building, weapon } = req.body;
  let user = users.get(user_id);
  if (!user) {
    user = {
      userId: user_id,
      balance: 10000,
      energy: 1500,
      miningRate: 1,
      energyLevel: 1,
      upgradeTapCost: 1000,
      upgradeEnergyCost: 1500,
      level: 1,
      experience: 0,
      currentWave: 1,
      referrals: [],
      lastEnergyUpdate: Math.floor(Date.now() / 1000),
      lastTap: 0,
      energySpent: 0,
      buildings: [],
      weapons: []
    };
    users.set(user_id, user);
  }

  const currentTime = Math.floor(Date.now() / 1000);
  const elapsed = currentTime - user.lastEnergyUpdate;
  user.energy = Math.min(1000 + user.energyLevel * 500, user.energy + Math.floor(elapsed / 60) * 10);
  user.lastEnergyUpdate = currentTime;

  if (action === 'tap') {
    if (user.energy < user.miningRate) return res.json({ status: 'error', message: 'Недостаточно энергии' });
    user.balance += user.miningRate;
    user.energy -= user.miningRate;
    user.energySpent += user.miningRate;
    if (user.energySpent >= 2000) {
      user.energySpent = 0;
      return res.json({ status: 'captcha_required' });
    }
    return res.json({ status: 'success', balance: user.balance, energy: user.energy, energy_spent: user.energySpent });
  }

  if (action === 'upgrade_tap') {
    if (user.miningRate >= 20) return res.json({ status: 'error', message: 'Максимальный уровень тапа' });
    const cost = user.upgradeTapCost;
    if (user.balance < cost) return res.json({ status: 'error', message: `Недостаточно $TSARC. Нужно ${cost}.` });
    user.balance -= cost;
    user.miningRate += 1;
    user.upgradeTapCost = Math.floor(cost * 1.5);
    return res.json({ status: 'success', balance: user.balance, mining_rate: user.miningRate, upgrade_tap_cost: user.upgradeTapCost });
  }

  if (action === 'upgrade_energy') {
    if (user.energyLevel >= 9) return res.json({ status: 'error', message: 'Максимальный уровень энергии' });
    const cost = user.upgradeEnergyCost;
    if (user.balance < cost) return res.json({ status: 'error', message: `Недостаточно $TSARC. Нужно ${cost}.` });
    user.balance -= cost;
    user.energyLevel += 1;
    user.energy = Math.min(1000 + user.energyLevel * 500, user.energy + 500);
    user.upgradeEnergyCost = Math.floor(cost * 1.7);
    return res.json({ status: 'success', balance: user.balance, energy_level: user.energyLevel, energy: user.energy, upgrade_energy_cost: user.upgradeEnergyCost });
  }

  if (action === 'start_wave') {
    if (user.currentWave > 50) return res.json({ status: 'error', message: 'Все волны пройдены' });const waveStrength = user.currentWave * 100;
    const userStrength = 1000;
    if (userStrength >= waveStrength) {
      const reward = user.currentWave * 1000;
      const exp = Math.floor(400 + Math.random() * 100);
      user.balance += reward;
      user.experience += exp;
      if (user.experience >= user.level * 1000) {
        user.level += 1;
        user.experience -= user.level * 1000;
      }
      user.currentWave += 1;
      return res.json({ status: 'success', balance: user.balance, experience: user.experience, level: user.level, wave: user.currentWave, reward, exp });
    }
    return res.json({ status: 'error', message: 'Недостаточно силы для волны' });
  }

  if (action === 'verify_captcha') {
    user.energySpent = 0;
    return res.json({ status: 'success' });
  }

  if (action === 'get_user') {
    return res.json({
      status: 'success',
      balance: user.balance,
      energy: user.energy,
      mining_rate: user.miningRate,
      energy_level: user.energyLevel,
      upgrade_tap_cost: user.upgradeTapCost,
      upgrade_energy_cost: user.upgradeEnergyCost,
      level: user.level,
      experience: user.experience,
      energy_spent: user.energySpent,
      buildings: user.buildings,
      weapons: user.weapons
    });
  }

  if (action === 'build') {
    const costs = {
      mine: 1000,
      barracks: 3000,
      fortress: 8000,
      tower: 2000,
      wall: 1500,
      armory: 4000,
      temple: 6000,
      castle: 10000,
      farm: 1200,
      lumbermill: 1800
    };
    if (!costs[building]) return res.json({ status: 'error', message: 'Неизвестное здание' });
    if (user.balance < costs[building]) return res.json({ status: 'error', message: `Недостаточно $TSARC. Нужно ${costs[building]}.` });
    user.balance -= costs[building];
    if (!Array.isArray(user.buildings)) user.buildings = [];
    user.buildings.push(building);
    return res.json({ status: 'success', balance: user.balance, buildings: user.buildings });
  }

  if (action === 'buy_weapon') {
    const costs = {
      sword: 500,
      bow: 1000,
      staff: 2000,
      spear: 800,
      axe: 1200,
      mace: 1500,
      dagger: 600,
      crossbow: 1800,
      hammer: 2200,
      flail: 2500
    };
    if (!costs[weapon]) return res.json({ status: 'error', message: 'Неизвестное оружие' });
    if (user.balance < costs[weapon]) return res.json({ status: 'error', message: `Недостаточно $TSARC. Нужно ${costs[weapon]}.` });
    user.balance -= costs[weapon];
    if (!Array.isArray(user.weapons)) user.weapons = [];
    user.weapons.push(weapon);
    return res.json({ status: 'success', balance: user.balance, weapons: user.weapons });
  }

  return res.json({ status: 'error', message: 'Неизвестное действие' });
});

server.listen(port, () => console.log(`Server running on port ${port}`));