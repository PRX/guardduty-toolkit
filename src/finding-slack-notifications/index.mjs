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
 * @property {InstanceResource | AccessKeyResource} resource
 * @property {Service} service
 * @property {number} severity
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string} title
 * @property {string} description
 */

/**
 * @typedef {Object} AccessKeyResource
 * @property {"AccessKey"} resourceType
 * @property {AccessKeyDetails} accessKeyDetails
 */

/**
 * @typedef {Object} AccessKeyDetails
 * @property {string} accessKeyId
 * @property {string} principalId
 */

/**
 * @typedef {Object} InstanceResource
 * @property {"Instance"} resourceType
 * @property {InstanceDetails} instanceDetails
 */

/**
 * @typedef {Object} InstanceDetails
 * @property {string} availabilityZone
 * @property {string} imageDescription
 * @property {string} imageId
 * @property {string} instanceId
 * @property {string} instanceState
 * @property {string} instanceType
 * @property {string} launchTime
 * @property {ResourceTag[]} tags
 */

/**
 * @typedef {Object} ResourceTag
 * @property {string} key
 * @property {string} value
 */

/**
 * @typedef {Object} Service
 * @property {string} serviceName
 * @property {string} resourceRole
 * @property {string} featureName
 * @property {string} eventFirstSeen
 * @property {string} eventLastSeen
 * @property {string} detectorId
 * @property {number} count
 * @property {boolean} archived
 * @property {NetworkConnectionAction} action
 */

/**
 * @typedef {Object} NetworkConnectionAction
 * @property {"NETWORK_CONNECTION"} actionType
 * @property {NetworkConnectionActionDetails} networkConnectionAction
 */

/**
 * @typedef {Object} NetworkConnectionActionDetails
 * @property {boolean} blocked
 * @property {NetworkConnectionIpDetails} localIpDetails
 * @property {NetworkConnectionIpDetails} remoteIpDetails
 */

/**
 * @typedef {Object} NetworkConnectionIpDetails
 * @property {string} ipAddressV4
 * @property {string} ipAddressV6
 * @property {IpCountry} country
 * @property {IpOrganization} organization
 */

/**
 * @typedef {Object} IpOrganization
 * @property {string} asn
 * @property {string} asnOrg
 * @property {string} isp
 * @property {string} org
 */

/**
 * @typedef {Object} IpCountry
 * @property {string} countryName
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
    "instanceDetails" in resource &&
    ["i-0b9daeb6c50763911"].includes(resource?.instanceDetails?.instanceId) &&
    finding.service.count > 10
  ) {
    return;
  }

  const details = [
    `*Account:* ${accountNickname}`,
    `*Region:* ${regionNickname}`,
    `*Type:* \`${finding.type}\``,
    `*Severity:* ${finding.severity}`,
    `*Title:* ${finding.title}`,
    `*Description:* ${finding.description}`,
  ];

  const remoteIp =
    finding?.service?.action?.networkConnectionAction?.remoteIpDetails;
  if (remoteIp?.ipAddressV4 || remoteIp?.ipAddressV6) {
    let ipDetails = `\`${remoteIp.ipAddressV4 || remoteIp.ipAddressV6}\``;

    const moreDetails = [];

    if (remoteIp.country?.countryName) {
      moreDetails.push(remoteIp.country.countryName);
    }

    if (remoteIp.organization?.asn) {
      moreDetails.push(`ASN: ${remoteIp.organization.asn}`);
    }
    if (remoteIp.organization?.asnOrg) {
      moreDetails.push(remoteIp.organization.asnOrg);
    }
    if (remoteIp.organization?.org) {
      moreDetails.push(remoteIp.organization.org);
    }

    if (moreDetails.length) {
      ipDetails = `${ipDetails} (${moreDetails.join(", ")})`;
    }

    details.push(`*Remote IP:* ${ipDetails}`);
  }

  if (finding?.resource?.resourceType === "Instance") {
    const instanceDetails = finding.resource.instanceDetails;

    if (instanceDetails?.instanceId) {
      let str = `\`${instanceDetails.instanceId}\``;

      const nameTag = instanceDetails.tags.find((t) => t.key === "Name");
      if (nameTag) {
        str = `${str} (Name: ${nameTag.value})`;
      }

      details.push(`*EC2 Instance:* ${str}`);
    }
  }

  const preamble = "A GuardDuty Finding has been reported:";
  const text = [preamble, details.join("\n>")].join("\n>");

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
