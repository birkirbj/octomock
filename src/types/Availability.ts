import { PickupPoint } from "./PickupPoint";
import { Pricing, PricingUnit } from "./Pricing";
export enum AvailabilityType {
  START_TIME,
  OPENING_HOURS,
}

export enum AvailabilityStatus {
  AVAILABLE,
  FREESALE,
  SOLD_OUT,
  LIMITED,
}

export interface OpeningHours extends OpeningHoursContent {
  from: string;
  to: string;
}

interface OpeningHoursContent {
  frequency?: Nullable<string>;
  frequencyAmount?: Nullable<number>;
  frequencyUnit?: Nullable<string>;
}

export interface Availability
  extends AvailabilityContent,
    AvailabilityPricing,
    AvailabilityPickup {
  id: string;
  localDateTimeStart: string;
  localDateTimeEnd: string;
  allDay: boolean;
  available: boolean;
  status: AvailabilityStatus;
  vacancies: Nullable<number>;
  capacity: Nullable<number>;
  maxUnits: Nullable<number>;
  utcCutoffAt: string;
  openingHours: OpeningHours[];
}

interface AvailabilityContent {
  meetingPoint?: Nullable<string>;
  meetingPointCoordinates?: Nullable<[number]>;
  meetingPointLatitude?: Nullable<number>;
  meetingPointLongitude?: Nullable<number>;
  meetingLocalDateTime?: Nullable<string>;
}

interface AvailabilityPricing {
  unitPricing?: PricingUnit[]; // pricingPer = UNIT
  pricing?: Pricing; // pricingPer = BOOKING
}

interface AvailabilityPickup {
  pickupAvailable?: boolean;
  pickupRequired?: boolean;
  pickupPoints?: PickupPoint[];
}