import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import { EventPayloadEnricher } from "./event-payload-enricher";
import { EventIdentifier } from "./event-identifier";
import { EventActioner } from "./event-actioner";
import { EventPostActioner } from "./event-post-actioner";
import { EventNotification } from "./event-notification";

export class EventCenterStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Include the EventIdentifier construct
    new EventIdentifier(this, "EventIdentifier");

    // Include the EventPayloadEnricher construct
    new EventPayloadEnricher(this, "EventPayloadEnricher");

    // Include the EventPayloadActioner construct
    new EventActioner(this, "EventPayloadActioner");

    // Include the EventNotification construct
    new EventNotification(this, "EventNotification");

    // Include the EventPostActioner construct
    new EventPostActioner(this, "EventPostActioner");
  }
}
