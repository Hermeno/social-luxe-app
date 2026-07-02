class Expo {
  static isExpoPushToken() { return true }
  chunkPushNotifications(messages) { return [messages] }
  async sendPushNotificationsAsync() { return [] }
}
module.exports = { Expo }
