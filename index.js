const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();
const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'http://localhost:5173'] }));
app.use(express.json());

// Фейковая база данных
const users = new Map();

// Ограничение тапов (5/сек)
const rateLimit = (req, res, next) => {
  const userId = req.body.user_id;
  let user = users.get(userId);
  if (!user) {
    user = {
      userId,
      balance: 50,
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
      energySpent: 0
    };
    users.set(userId, user);
  }
  const currentTime = Math.floor(Date.now() / 1000);
  if (user.lastTap && currentTime - user.lastTap < 0.2) {
    return res.json({ status: 'error', message: 'Слишком много тапов! Подождите.' });
  }
  user.lastTap = currentTime;
  next();
};

app.post('/api', rateLimit, async (req, res) => {
  const { user_id, action, token, platform } = req.body;
  let user = users.get(user_id);
  if (!user) {
    user = {
      userId: user_id,
      balance: 50,
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
      energySpent: 0
    };
    users.set(user_id, user);
  }

  // Проверка платформы
  if (!platform || !['ios', 'android'].includes(platform)) {
    return res.json({ status: 'error', message: 'Игра доступна только на мобильных устройствах' });
  }

  // Обновление энергии
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
    const waveStrength = user.currentWave * 100;
    const userStrength = 1000; // Заглушка
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
      energy_spent: user.energySpent
    });
  }

  return res.json({ status: 'error', message: 'Неизвестное действие' });
});

app.listen(8081, () => console.log('Server running on port 8081'));