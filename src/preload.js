const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("macro", {
  platform: process.platform,
});
