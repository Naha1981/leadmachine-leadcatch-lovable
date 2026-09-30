import React from "react";
import { Composition } from "remotion";
import { LeadMachineVideo, type LeadMachineVideoProps } from "./LeadMachineVideo";

const defaultProps: LeadMachineVideoProps = {
  prospectId: "NL-DEMO-0001",
  businessName: "ABC Roofing",
  industry: "Roofing",
  location: "Sandton",
  googleRating: 4.7,
  reviewCount: 93,
  website: "https://example.com",
  currentCta: "Website + WhatsApp",
  currentEnquiryFlow: "Website enquiry → manual response",
  websiteEnquiryForm: "Yes",
  onlineBooking: "No",
  quoteRequest: "Yes",
  whatsAppCta: "Yes",
  digitalPresenceGap: "The public enquiry path is visible; qualification and follow-up are not.",
  observedEnquiryFriction: "A high-intent quote request still depends on a human moving the enquiry through the next step.",
  potentialLeakageRisk: "When the first response or follow-up is delayed, a time-sensitive prospect can move on before a quote is issued.",
  leadMachineConcept: "Lead Machine turns the first enquiry into structured intent, priority, next action and follow-up.",
  conversionEvent: "Qualified quote / booked job",
  followUpSequence: "Immediate response → qualification → reminder → human hand-off",
  prospectTier: "A",
  demoUrl: "https://demo.leadmachine.co.za/NL-DEMO-0001",
};

export const Root: React.FC = () => (
  <Composition
    id="LeadMachineVideo"
    component={LeadMachineVideo}
    durationInFrames={900}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={defaultProps}
  />
);
