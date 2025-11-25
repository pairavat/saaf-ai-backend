// import admin from "..firebase/firebase.js";
import admin from "../firebase/firebase.js";

export const sendNotification = async (req, res) => {
  try {
    const { token, title, body, data } = req.body;

    const message = {
      token: token,
      notification: {
        title: title,
        body: body,
      },
      data: data || {},
    };

    const response = await admin.messaging().send(message);

    return res.status(200).json({
      success: true,
      response,
    });
  } catch (error) {
    console.error("FCM Error:", error);
    return res.status(500).json({ success: false, error });
  }
};

export const sendNotificationToMany = async ({
  tokens,
  title,
  body,
  data = {},
}) => {
  try {
    const message = {
      tokens,
      notification: { title, body },
      data,
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    return { success: true, response };
  } catch (error) {
    console.error("FCM Error:", error);
    return { success: false, error };
  }
};
