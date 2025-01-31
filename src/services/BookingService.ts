import { Booking } from "@octocloud/types";
import { InvalidBookingUUIDError } from "./../models/Error";
import { GetBookingSchema, GetBookingsSchema } from "./../schemas/Booking";
import { BookingModel } from "./../models/Booking";
import { DB } from "../storage/Database";
import { DateHelper } from "../helpers/DateHelper";

interface IBookingService {
  createBooking(bookingModel: BookingModel): Promise<BookingModel>;
  updateBooking(bookingModel: BookingModel): Promise<BookingModel>;
  getBooking(bookingModel: BookingModel): Promise<BookingModel>;
  getBookings(schema: GetBookingsSchema): Promise<BookingModel[]>;
}

export class BookingService implements IBookingService {
  public createBooking = async (
    bookingModel: BookingModel
  ): Promise<BookingModel> => {
    await DB.getInstance()
      .getDB()
      .run(
        `
      INSERT INTO booking (
        id,
        status,
        resellerReference,
        supplierReference,
        createdAt,
        data
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
        bookingModel.uuid,
        bookingModel.status,
        bookingModel.resellerReference,
        bookingModel.supplierReference,
        DateHelper.getDate(bookingModel.utcCreatedAt),
        JSON.stringify(bookingModel.toPOJO({}))
      );
    return bookingModel;
  };

  public updateBooking = async (
    bookingModel: BookingModel
  ): Promise<BookingModel> => {
    await DB.getInstance()
      .getDB()
      .run(
        `
      UPDATE booking
        SET status = ?,
            resellerReference = ?,
            data = ?
        WHERE id = ?
    `,
        bookingModel.status,
        bookingModel.resellerReference,
        JSON.stringify(bookingModel.toPOJO({})),
        bookingModel.uuid
      );
    return bookingModel;
  };

  public getBooking = async (data: GetBookingSchema): Promise<BookingModel> => {
    const result =
      (await DB.getInstance()
        .getDB()
        .get(`SELECT * FROM booking WHERE id = ?`, data.uuid)) ?? null;
    if (result == null) {
      throw new InvalidBookingUUIDError(data.uuid);
    }
    const booking = JSON.parse(result.data) as Booking;
    const bookingModel = BookingModel.fromPOJO(booking);
    this.handleExpiredBooking(bookingModel);
    return bookingModel;
  };

  private handleExpiredBooking = (booking: BookingModel): void => {
    const isExpired =
      booking.utcExpiresAt < DateHelper.utcDateFormat(new Date());
    if (isExpired) {
      throw new InvalidBookingUUIDError(booking.uuid);
    }
  };

  public getBookings = async (
    data: GetBookingsSchema
  ): Promise<BookingModel[]> => {
    const selectQuery = "SELECT * FROM booking WHERE ";
    const query = [];
    const params = [];
    if (data.resellerReference) {
      query.push("resellerReference = ?");
      params.push(data.resellerReference);
    }
    if (data.supplierReference) {
      query.push("supplierReference = ?");
      params.push(data.supplierReference);
    }

    if (data.localDateStart && data.localDateEnd) {
      query.push("createdAt BETWEEN ? AND ?");
      params.push(data.localDateStart);
      params.push(data.localDateEnd);
    } else if (data.localDate) {
      query.push("createdAt = ? ");
      params.push(data.localDate);
    }

    const result = await DB.getInstance()
      .getDB()
      .all(selectQuery + query.join(" AND "), ...params);
    return result.map((r) =>
      BookingModel.fromPOJO(JSON.parse(r.data) as Booking)
    );
  };
}
