interface WeatherData {
    name: string;
    main: {
        temp: number;
        feels_like: number;
        humidity: number;
        pressure: number;
    };
    weather: Array<{
        description: string;
        main: string;
        icon: string;
    }>;
    wind: {
        speed: number;
    };
    sys: {
        country: string;
    };
}
export declare class WeatherService {
    private readonly BASE_URL;
    getWeather(city: string): Promise<WeatherData>;
    getWeatherEmoji(weatherMain: string): string;
}
export {};
//# sourceMappingURL=WeatherService.d.ts.map