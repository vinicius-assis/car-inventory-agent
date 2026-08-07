import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { describe, it, expect } from "vitest";
import { GET_CARS } from "@/graphql/queries";
import CarList from "@/components/CarList";
import type { Car } from "@/types";

const mockCars: Car[] = [
  {
    id: "1",
    make: "Toyota",
    model: "Camry",
    year: 2024,
    color: "Silver",
    mobile: "https://placehold.co/640x360",
    tablet: "https://placehold.co/1023x576",
    desktop: "https://placehold.co/1440x810",
  },
  {
    id: "2",
    make: "Honda",
    model: "Accord",
    year: 2023,
    color: "Black",
    mobile: "https://placehold.co/640x360",
    tablet: "https://placehold.co/1023x576",
    desktop: "https://placehold.co/1440x810",
  },
  {
    id: "3",
    make: "Ford",
    model: "Mustang",
    year: 2022,
    color: "Red",
    mobile: "https://placehold.co/640x360",
    tablet: "https://placehold.co/1023x576",
    desktop: "https://placehold.co/1440x810",
  },
];

const mockCarsWithTypename = mockCars.map((car) => ({
  ...car,
  __typename: "Car" as const,
}));

const mocks = [
  {
    request: { query: GET_CARS },
    result: { data: { cars: mockCarsWithTypename } },
  },
];

describe("CarList component", () => {
  it("renders loading state initially", () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <CarList />
      </MockedProvider>
    );

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders car data after loading", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <CarList />
      </MockedProvider>
    );

    await waitFor(() => expect(screen.getByText("2024 Toyota Camry")).toBeInTheDocument());
    expect(screen.getByText("2023 Honda Accord")).toBeInTheDocument();
    expect(screen.getByText("2022 Ford Mustang")).toBeInTheDocument();
  });

  it("filters cars based on search input", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <CarList />
      </MockedProvider>
    );

    await waitFor(() => expect(screen.getByText("2024 Toyota Camry")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/search by model/i), {
      target: { value: "Mustang" },
    });
    expect(screen.getByText("2022 Ford Mustang")).toBeInTheDocument();
    expect(screen.queryByText("2024 Toyota Camry")).not.toBeInTheDocument();
  });

  it("sorts cars based on the selected option", async () => {
    render(
      <MockedProvider mocks={mocks} addTypename={false}>
        <CarList />
      </MockedProvider>
    );

    await waitFor(() => expect(screen.getByText("2024 Toyota Camry")).toBeInTheDocument());

    fireEvent.mouseDown(screen.getByLabelText('Sort by'));
    fireEvent.click(screen.getByText(/make/i));

    const carModels = screen.getAllByTestId('car-model').map((element) => element.textContent);
    expect(carModels).toEqual(["2023 Honda Accord", "2022 Ford Mustang", "2024 Toyota Camry"]);
  });
});

