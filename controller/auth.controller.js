const User = require("../models/user.model");
const jwt = require("jsonwebtoken");

const path = require("path");
const fs = require("fs/promises");

const config = require("../config/config");
const Jimp = require("jimp");

require("dotenv").config();
const signup = async (req, res, next) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user) {
    return res
      .status(409)
      .header("Content-Type", "application/json")
      .json({
        status: "conflict",
        code: 409,
        ResponseBody: {
          message: "Email in use",
        },
      });
  }
  try {
    const newUser = new User({ email });
    newUser.generateAvatar();
    newUser.setPassword(password);
    await newUser.save();
    res
      .status(201)
      .header("Content-Type", "application/json")
      .json({
        status: "created",
        code: 201,
        ResponseBody: {
          user: {
            email: email,
            subscription: "starter",
          },
        },
      });
  } catch (error) {
    next(error);
  }
};
const login = async (req, res, next) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user || !user.validPassword(password)) {
    return res.status(401).json({
      status: "unauthorized",
      code: 401,
      ResponseBody: {
        message: "Email or password is wrong",
      },
    });
  }
  const payload = {
    id: user._id,
  };
  const token = jwt.sign(payload, process.env.SECRET, { expiresIn: "1h" });
  user.token = token;
  await user.save();
  res
    .status(200)
    .header("Content-Type", "application/json")
    .json({
      status: "created",
      code: 201,
      ResponseBody: {
        token,
        user: {
          email,
          subscription: "starter", // TODO
        },
      },
    });
};

const logout = async (req, res, next) => {
  const id = req.user._id;
  try {
    const user = await User.findById(id);
    if (!user) {
      return res
        .status(401)
        .header("Content-Type", "application/json")
        .json({
          status: "Unauthorized",
          code: 401,
          ResponseBody: {
            message: "Not authorized",
          },
        });
    }

    user.token = null;
    await user.save();

    res.status(204).json({
      status: "no content",
      code: 204,
    });
  } catch (error) {
    next(error);
  }
};

const getCurrent = async (req, res, next) => {
  const { _id, email, avatarURL } = req.user;
  try {
    const user = await User.findById(_id);
    if (!user) {
      return res
        .status(401)
        .header("Content-Type", "application/json")
        .json({
          status: "Unauthorized",
          code: 401,
          ResponseBody: {
            message: "Not authorized",
          },
        });
    }
    res
      .status(200)
      .header("Content-Type", "application/json")
      .json({
        status: "OK",
        code: 200,
        ResponseBody: {
          email: email,
          subscription: "starter",
          avatarURL: avatarURL,
        },
      });
  } catch (error) {
    next(error);
  }
};

const updateAvatars = async (req, res) => {
  const { _id } = req.user;
  const { path: tmpUpload, originalname } = req.file;
  const filename = `${_id}_${originalname}`;
  const resultUpload = path.join(config.AVATARS_PATH, filename);
  await fs.rename(tmpUpload, resultUpload);
  const avatar = await Jimp.read(resultUpload);
  avatar.resize(250, 250);
  avatar.write(resultUpload);
  const avatarURL = path.join("avatars", filename);
  await User.findByIdAndUpdate(_id, { avatarURL });
  res.status(200).json({ avatarURL });
};

module.exports = {
  signup,
  login,
  logout,
  getCurrent,
  updateAvatars,
};