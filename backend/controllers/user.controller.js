const userService = require('../services/user.service');

exports.listUsers = async (req, res) => {
  try {
    const users = await userService.listUsers(req.companyId);
    res.json({ data: users });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const user = await userService.createUser(req.companyId, req.body, req.user);
    res.status(201).json({ data: user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await userService.updateUser(req.params.id, req.companyId, req.body, req.user);
    res.json({ data: user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const result = await userService.deactivateUser(req.params.id, req.companyId, req.user);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
