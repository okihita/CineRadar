export interface TheaterSchedule {
    theatre_id: string;
    theatre_name: string;
    merchant: string;
    address: string;
    lat?: number;
    lng?: number;
    rooms: {
        category: string;
        price: string;
        showtimes: string[];
        past_showtimes?: string[];
    }[];
}
