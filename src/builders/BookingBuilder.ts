import { InvalidOptionIdError, InvalidUnitIdError } from './../models/Error';
import { DeliveryFormat } from "./../types/Product";
import { addMinutes } from "date-fns";
import { DataGenerator } from "./../generators/DataGenerator";
import {
  ConfirmBookingSchema,
  CreateBookingSchema,
  OctoUnitItem,
  Contact,
  CancelBookingSchema,
  ExtendBookingSchema,
  UpdateBookingSchema,
} from "./../schemas/Booking";
import {
  BookingStatus,
  BookingAvailability,
  UnitItem,
  Voucher,
} from "./../types/Booking";
import { OptionModel } from "./../models/Option";
import { ProductModel } from "./../models/Product";
import { BookingModel } from "./../models/Booking";
import { DateHelper } from "../helpers/DateHelper";
import { RedemptionMethod } from "../types/Product";

interface BookingBuilderData {
  product: ProductModel;
  availability: BookingAvailability;
}

export class BookingBuilder {
  createBooking(
    data: BookingBuilderData,
    schema: CreateBookingSchema
  ): BookingModel {
    const status = BookingStatus.ON_HOLD;
    const option = data.product.getOption(schema.optionId);
    if (option === null) {
      throw new InvalidOptionIdError(schema.optionId)
    }

    let utcExpiresAt = DateHelper.bookingUTCFormat(addMinutes(new Date(), 30));
    if (schema.expirationMinutes) {
      utcExpiresAt = DateHelper.bookingUTCFormat(
        addMinutes(new Date(), schema.expirationMinutes)
      );
    }

    // TODO: allow update unit items
    // TODO: calculate booking pricing
    const bookingModel = new BookingModel({
      id: DataGenerator.generateUUID(),
      uuid: schema.uuid ?? DataGenerator.generateUUID(),
      resellerReference: schema.resellerReference ?? null,
      supplierReference: DataGenerator.generateSupplierReference(),
      status,
      product: data.product,
      option,
      availability: data.availability,
      contact: this.updateContact({ booking: null, contact: schema.contact }),
      unitItems: schema.unitItems.map((item) =>
        this.buildUnitItem(item, status, option)
      ),
      utcCreatedAt: DateHelper.bookingUTCFormat(new Date()),
      utcUpdatedAt: DateHelper.bookingUTCFormat(new Date()),
      utcExpiresAt: utcExpiresAt,
      utcRedeemedAt: null,
      utcConfirmedAt: null,
      notes: schema.notes ?? null,
      freesale: schema.freesale,
    });

    return bookingModel;
  }

  confirmBooking(
    booking: BookingModel,
    schema: ConfirmBookingSchema
  ): BookingModel {
    const status = BookingStatus.CONFIRMED;

    const bookingModel = new BookingModel({
      id: booking.id,
      uuid: booking.uuid,
      resellerReference: schema.resellerReference ?? booking.resellerReference,
      supplierReference: booking.supplierReference,
      status,
      product: booking.product,
      option: booking.option,
      availability: booking.availability,
      contact: this.updateContact({ booking, contact: schema.contact }),
      unitItems: this.generateTickets(booking),
      utcCreatedAt: booking.utcCreatedAt,
      utcUpdatedAt: DateHelper.bookingUTCFormat(new Date()),
      utcExpiresAt: null,
      utcRedeemedAt: null,
      utcConfirmedAt: DateHelper.bookingUTCFormat(new Date()),
      notes: schema.notes ?? booking.notes,
      voucher: this.generateVoucher(booking),
      freesale: schema.freesale,
    });

    return bookingModel;
  }

  updateBooking(
    booking: BookingModel,
    schema: UpdateBookingSchema
  ): BookingModel {
    const status = booking.status;

    let utcExpiresAt = booking.utcExpiresAt;
    if (schema.expirationMinutes) {
      utcExpiresAt = DateHelper.bookingUTCFormat(
        addMinutes(new Date(), schema.expirationMinutes)
      );
    }
    const bookingModel = new BookingModel({
      id: booking.id,
      uuid: booking.uuid,
      resellerReference: schema.resellerReference ?? booking.resellerReference,
      supplierReference: booking.supplierReference,
      status,
      product: booking.product,
      option: booking.option,
      availability: booking.availability,
      contact: this.updateContact({ booking, contact: schema.contact }),
      unitItems: booking.unitItems,
      utcCreatedAt: booking.utcCreatedAt,
      utcUpdatedAt: DateHelper.bookingUTCFormat(new Date()),
      utcExpiresAt: utcExpiresAt,
      utcRedeemedAt: null,
      utcConfirmedAt: DateHelper.bookingUTCFormat(new Date()),
      notes: schema.notes ?? booking.notes,
      voucher: booking.voucher,
      freesale: schema.freesale,
    });

    return bookingModel;
  }

  extendBooking(
    booking: BookingModel,
    schema: ExtendBookingSchema
  ): BookingModel {
    const status = BookingStatus.ON_HOLD;

    const bookingModel = new BookingModel({
      id: booking.id,
      uuid: booking.uuid,
      resellerReference: booking.resellerReference,
      supplierReference: booking.supplierReference,
      status,
      product: booking.product,
      option: booking.option,
      availability: booking.availability,
      contact: booking.contact,
      unitItems: booking.unitItems,
      utcCreatedAt: booking.utcCreatedAt,
      utcUpdatedAt: DateHelper.bookingUTCFormat(new Date()),
      utcExpiresAt: DateHelper.bookingUTCFormat(
        addMinutes(new Date(), schema.expirationMinutes ?? 30)
      ),
      utcRedeemedAt: null,
      utcConfirmedAt: null,
      notes: booking.notes,
      voucher: booking.voucher,
      freesale: booking.freesale,
    });

    return bookingModel;
  }

  cancelBooking(
    booking: BookingModel,
    schema: CancelBookingSchema
  ): BookingModel {
    const status = BookingStatus.CANCELLED;
    const cancellation = {
      refund: "FULL",
      reason: schema.reason ?? null,
      utcCancelledAt: DateHelper.bookingUTCFormat(new Date()),
    };

    const bookingModel = new BookingModel({
      id: booking.id,
      uuid: booking.uuid,
      resellerReference: booking.resellerReference,
      supplierReference: booking.supplierReference,
      status,
      product: booking.product,
      option: booking.option,
      availability: booking.availability,
      contact: booking.contact,
      unitItems: [],
      utcCreatedAt: booking.utcCreatedAt,
      utcUpdatedAt: DateHelper.bookingUTCFormat(new Date()),
      utcExpiresAt: DateHelper.bookingUTCFormat(addMinutes(new Date(), 30)),
      utcRedeemedAt: null,
      utcConfirmedAt: null,
      notes: booking.notes,
      cancellation,
      freesale: booking.freesale,
    });

    return bookingModel;
  }

  private generateTickets = (booking: BookingModel): UnitItem[] => {
    return booking.unitItems.map((item) => {
      const deliveryOptions = [];
      if (booking.product.deliveryFormats.includes(DeliveryFormat.PDF_URL)) {
        deliveryOptions.push({
          deliveryFormat: DeliveryFormat.PDF_URL,
          deliveryValue: `https://api.octomock.com/octo/pdf?booking=${booking.uuid}&ticket=${item.uuid}`,
        });
      }
      if (booking.product.deliveryFormats.includes(DeliveryFormat.QRCODE)) {
        deliveryOptions.push({
          deliveryFormat: DeliveryFormat.QRCODE,
          deliveryValue: item.supplierReferecne,
        });
      }
      const ticket = item.ticket;
      return {
        ...item,
        ticket: {
          ...ticket,
          deliveryOptions,
        },
      };
    });
  };

  private generateVoucher = (booking: BookingModel): Voucher => {
    const deliveryOptions = [];
    if (booking.product.deliveryFormats.includes(DeliveryFormat.PDF_URL)) {
      deliveryOptions.push({
        deliveryFormat: DeliveryFormat.PDF_URL,
        deliveryValue: `https://api.octomock.com/octo/pdf?booking=${booking.uuid}`,
      });
    }
    if (booking.product.deliveryFormats.includes(DeliveryFormat.QRCODE)) {
      deliveryOptions.push({
        deliveryFormat: DeliveryFormat.QRCODE,
        deliveryValue: booking.supplierReference,
      });
    }
    return {
      redemptionMethod: booking.product.redemptionMethod,
      utcRedeemedAt: null,
      deliveryOptions: deliveryOptions,
    };
  };

  private updateContact = ({
    booking,
    contact,
  }: {
    booking: Nullable<BookingModel>;
    contact?: Contact;
  }) => {
    return {
      fullName: contact?.fullName ?? booking?.contact?.fullName ?? null,
      firstName: contact?.firstName ?? booking?.contact?.firstName ?? null,
      lastName: contact?.lastName ?? booking?.contact?.lastName ?? null,
      emailAddress:
        contact?.emailAddress ?? booking?.contact?.emailAddress ?? null,
      phoneNumber:
        contact?.phoneNumber ?? booking?.contact?.phoneNumber ?? null,
      locales: contact?.locales ?? booking?.contact?.locales ?? null,
      country: contact?.country ?? booking?.contact?.country ?? null,
      notes: contact?.notes ?? booking?.contact?.notes ?? null,
    };
  };

  private buildUnitItem = (
    item: OctoUnitItem,
    status: BookingStatus,
    option: OptionModel
  ): UnitItem => {
    const unitModel = option.findUnitModel(item.unitId);
    if (unitModel === null) {
      throw new InvalidUnitIdError(item.unitId)
    }
    const unitItem: UnitItem = {
      uuid: item.uuid ?? DataGenerator.generateUUID(),
      supplierReferecne: DataGenerator.generateSupplierReference(),
      resellerReference: item.resellerReference ?? null,
      unitId: item.unitId,
      unit: unitModel.toPOJO({}),
      status,
      utcRedeemedAt: null,
      contact: {
        fullName: null,
        firstName: null,
        lastName: null,
        emailAddress: null,
        phoneNumber: null,
        locales: [],
        country: null,
        notes: null,
      },
      ticket: {
        redemptionMethod: RedemptionMethod.DIGITAL,
        utcRedeemedAt: null,
        deliveryOptions: [],
      },
    };

    return unitItem;
  };
}
