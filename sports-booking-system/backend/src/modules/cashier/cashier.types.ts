export interface AddServiceToBookingInput {
  serviceId: string;
  quantity: number;
}

export interface UpdateBookingServiceInput {
  quantity: number;
}

export interface ReturnRentalItemInput {
  rentalItemId: string;
  status: "RETURNED" | "DAMAGED" | "LOST";
  notes?: string;
}
