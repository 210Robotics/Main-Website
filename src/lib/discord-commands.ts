export const discordApplicationCommands = [
  {
    name: "ask",
    description: "Ask the Gemini-powered 210 Robotics assistant",
    options: [
      {
        type: 3,
        name: "prompt",
        description: "What would you like help with?",
        required: true,
        max_length: 1_000,
      },
    ],
  },
  {
    name: "record",
    description: "Have the bot join a voice channel and record the meeting",
    default_member_permissions: "8",
    options: [
      {
        type: 3,
        name: "title",
        description: "Meeting title for the recording and transcript",
        required: true,
        max_length: 180,
      },
      {
        type: 7,
        name: "voice_channel",
        description: "Voice channel the bot should join and record",
        required: true,
        channel_types: [2, 13],
      },
    ],
  },
  {
    name: "stopall",
    description: "Stop and finalize every active voice recording",
    default_member_permissions: "8",
  },
  {
    name: "voice",
    description: "Inspect or control the Discord voice recorder",
    default_member_permissions: "8",
    options: [
      { type: 1, name: "status", description: "Show the current voice recording state" },
      { type: 1, name: "diagnostics", description: "Show voice health and reconnect details" },
      { type: 1, name: "reconnect", description: "Reconnect the active recording safely" },
      { type: 1, name: "stop", description: "Stop and archive this server's recording" },
    ],
  },
  {
    name: "sync",
    description: "Synchronize Discord members and messages with the portal",
    default_member_permissions: "8",
  },
  {
    name: "logs",
    description: "Synchronize messages and publish a full Botlog archive",
    default_member_permissions: "8",
  },
  {
    name: "calendar",
    description: "Check the team calendar and send eligible reminders",
    default_member_permissions: "8",
  },
  {
    name: "digest",
    description: "Send the upcoming-month Google Calendar digest",
    default_member_permissions: "8",
  },
  {
    name: "timeout",
    description: "Timeout or unmute a Discord member",
    default_member_permissions: "8",
    options: [
      {
        type: 6,
        name: "member",
        description: "Member to timeout or unmute",
        required: true,
      },
      {
        type: 4,
        name: "minutes",
        description: "Timeout duration; use 0 to clear",
        required: true,
        choices: [
          { name: "Clear timeout", value: 0 },
          { name: "5 minutes", value: 5 },
          { name: "10 minutes", value: 10 },
          { name: "30 minutes", value: 30 },
          { name: "1 hour", value: 60 },
          { name: "6 hours", value: 360 },
          { name: "1 day", value: 1_440 },
          { name: "7 days", value: 10_080 },
          { name: "28 days", value: 40_320 },
        ],
      },
      {
        type: 3,
        name: "reason",
        description: "Reason recorded in the Discord audit log",
        required: false,
        max_length: 400,
      },
    ],
  },
  {
    name: "register",
    description: "Link your Discord identity to your 210 Robotics account",
  },
  {
    name: "status",
    description: "Check your 210 Robotics account-link status",
  },
  {
    name: "dues",
    description: "Check your current 210 Robotics membership dues status",
  },
  {
    name: "team",
    description: "View Discord and website membership totals",
  },
  {
    name: "setup",
    description: "Connect this server to the 210 Robotics admin portal",
    default_member_permissions: "8",
  },
] as const;
