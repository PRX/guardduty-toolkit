import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import accounts from "./accounts.mjs";
import regions from "./regions.mjs";

const eventbridge = new EventBridgeClient({ apiVersion: "2015-10-07" });

export const handler = async (event) => {
  console.log(
    JSON.stringify({
      msg: "Input event",
      event,
    }),
  );

  const region = event.detail.region;
  const regionNickname = regions(region);
  const accountNickname = accounts(event.detail.accountId);
  const findingType = event.detail.type;

  await eventbridge.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: "org.prx.guardduty",
          DetailType: "Slack Message Relay Message Payload",
          Detail: JSON.stringify({
            username: "Amazon GuardDuty",
            icon_emoji: ":ops-guardduty:",
            channel: "C0BAG86NKJL", // #ops-security
            text: `A GuardDuty Finding has been reported:\n> ${accountNickname} – ${regionNickname} \`${findingType}\``,
          }),
        },
      ],
    }),
  );
};
