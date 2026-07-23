/** @import { EventBridgeEvent } from "aws-lambda" */

/**
 * @typedef {Object} GuardDutyFindingDetail
 * @property {string} schemaVersion
 * @property {string} accountId
 * @property {string} region
 * @property {string} partition
 * @property {string} id
 * @property {string} arn
 * @property {string} type
 * @property {InstanceResource} resource
 * @property {FindingService} service
 * @property {number} severity
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} title
 * @property {string} description
 */

/**
 * @typedef {Object} InstanceResource
 * @property {"Instance"} resourceType
 * @property {InstanceResourceDetails} instanceDetails
 */

/**
 * @typedef {Object} InstanceResourceDetails
 * @property {string} availabilityZone
 * @property {string} imageDescription
 * @property {string} imageId
 * @property {string} instanceId
 * @property {string} instanceState
 * @property {string} instanceType
 * @property {string} launchTime
 */

/**
 * @typedef {Object} FindingService
 * @property {string} serviceName
 * @property {string} resourceRole
 * @property {string} featureName
 * @property {string} eventFirstSeen
 * @property {string} eventLastSeen
 * @property {string} detectorId
 * @property {number} count
 * @property {boolean} archived
 */

import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import accounts from "./accounts.mjs";
import regions from "./regions.mjs";

const eventbridge = new EventBridgeClient({ apiVersion: "2015-10-07" });

/**
 * @param {EventBridgeEvent<"GuardDuty Finding", GuardDutyFindingDetail>} event
 * @returns {Promise<void>}
 */
export const handler = async (event) => {
  console.log(
    JSON.stringify({
      msg: "Input event",
      event,
    }),
  );

  const finding = event.detail;
  const regionNickname = regions(finding.region);
  const accountNickname = accounts(finding.accountId);

  const { resource } = finding;

  if (
    ["i-0b9daeb6c50763911"].includes(resource?.instanceDetails?.instanceId) &&
    finding.service.count > 10
  ) {
    return;
  }

  const preamble = "A GuardDuty Finding has been reported:";
  const details = [
    `*Account:* ${accountNickname}`,
    `*Region:* ${regionNickname}`,
    `*Type:* \`${finding.type}\``,
    `*Severity:* ${finding.severity}`,
    `*Title:* ${finding.title}`,
    `*Description:* ${finding.description}`,
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
