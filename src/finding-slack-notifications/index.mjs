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

  const preamble = "A GuardDuty Finding has been reported:";
  const details = [
    `*Account:* ${accountNickname}`,
    `*Region:* ${regionNickname}`,
    `*Type:* \`${event.detail.type}\``,
    `*Severity:* ${event.detail.severity}`,
    `*Title:* ${event.detail.title}`,
    `*Description:* ${event.detail.description}`,
  ].join("\n>");
  const text = [preamble, details].join("\n>");

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
            text,
          }),
        },
      ],
    }),
  );
};
