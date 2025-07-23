// @ts-nocheck
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  userId: { type: Number, unique: true },
  balance: { type: Number, default: 50 },
  energy: { type: Number, default: 1500 },
  miningRate: { type: Number, default: 1 },
  energyLevel: { type: Number, default: 1 },
  upgradeTapCost: { type: Number, default: 1000 },
  upgradeEnergyCost: { type: Number, default: 1500 },
  level: { type: Number, default: 1 },
  experience: { type: Number, default: 0 },
  currentWave: { type: Number, default: 1 },
  referrals: [{ userId: String, referredAt: Date, referralIncome: Number }],
  lastEnergyUpdate: { type: Number, default: () => Math.floor(Date.now() / 1000) },
  lastTap: { type: Number, default: 0 },
  energySpent: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', UserSchema);