"use server";

import { prisma } from "@smart-school/db";
import webpush from "web-push";

// Initialize web-push with VAPID keys
// We only configure this if the keys are present (to avoid crashing if not set in some envs)
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "mailto:admin@smartschool.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

export async function subscribeToPush(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  deviceLabel?: string
) {
  const existing = await prisma.pushSubscription.findUnique({
    where: {
      userId_endpoint: {
        userId,
        endpoint: subscription.endpoint,
      },
    },
  });

  if (existing) {
    return prisma.pushSubscription.update({
      where: { id: existing.id },
      data: {
        p256dhKey: subscription.keys.p256dh,
        authKey: subscription.keys.auth,
        deviceLabel: deviceLabel || existing.deviceLabel,
      },
    });
  }

  return prisma.pushSubscription.create({
    data: {
      userId,
      endpoint: subscription.endpoint,
      p256dhKey: subscription.keys.p256dh,
      authKey: subscription.keys.auth,
      deviceLabel,
    },
  });
}

export async function unsubscribeFromPush(userId: string, endpoint: string) {
  try {
    await prisma.pushSubscription.delete({
      where: {
        userId_endpoint: {
          userId,
          endpoint,
        },
      },
    });
  } catch (error) {
    // Ignore if already deleted
  }
}

export async function sendPushNotification(userId: string, payload: any) {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn("VAPID keys not configured, skipping push notification.");
    return;
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  const payloadString = JSON.stringify(payload);

  const sendPromises = subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dhKey,
            auth: sub.authKey,
          },
        },
        payloadString
      );
    } catch (error: any) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        // Subscription has expired or is no longer valid
        console.log(`Subscription ${sub.id} expired. Removing...`);
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      } else {
        console.error("Error sending push notification", error);
      }
    }
  });

  // Await all locally so the function completes without terminating promises prematurely,
  // but the caller can call this function without awaiting it for non-blocking behavior.
  await Promise.allSettled(sendPromises);
}

export async function notifySchoolAdmins(schoolId: string, payload: any) {
  const admins = await prisma.user.findMany({
    where: { schoolId, role: "admin" },
    select: { id: true },
  });

  // Non-blocking loop
  Promise.allSettled(
    admins.map((admin) => sendPushNotification(admin.id, payload))
  );
}
