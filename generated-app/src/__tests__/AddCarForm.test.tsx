import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing";
import { describe, it, expect } from "vitest";
import { ADD_CAR, GET_CARS } from "@/graphql/queries";
import AddCarForm from "@/components/AddCarForm";

const mockCar = {
  id: "1",
  make: "Tesla",
  model: "Model S",
  year: 2022,
  color: "Red",
  mobile: "https://placehold.co/640x360",
  tablet: "https://placehold.co/1023x576",
  desktop: "https://placehold.co/1440x810",
  __typename: "Car" as const,
};

const addCarMock = {
  request: {
    query: ADD_CAR,
    variables: { make: "Tesla", model: "Model S", year: 2022, color: "Red" },
  },
  result: {
    data: {
      addCar: mockCar,
    },
  },
};

const carsQueryMock = {
  request: {
    query: GET_CARS,
  },
  result: {
    data: {
      cars: [mockCar],
    },
  },
};

describe("AddCarForm Component", () => {
  it("successfully adds a new car and refetches the car list", async () => {
    render(
      <MockedProvider mocks={[addCarMock, carsQueryMock]} addTypename={true}>
        <AddCarForm />
      </MockedProvider>
    );

    fireEvent.change(screen.getByLabelText(/make/i), {
      target: { value: "Tesla" },
    });
    fireEvent.change(screen.getByLabelText(/model/i), {
      target: { value: "Model S" },
    });
    fireEvent.change(screen.getByLabelText(/year/i), {
      target: { value: "2022" },
    });
    fireEvent.change(screen.getByLabelText(/color/i), {
      target: { value: "Red" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add car/i }));

    await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());

    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByLabelText(/make/i)).toHaveValue("");
      expect(screen.getByLabelText(/model/i)).toHaveValue("");
      expect(screen.getByLabelText(/year/i)).toHaveValue(null);
      expect(screen.getByLabelText(/color/i)).toHaveValue("");
    });
  });

  it("displays loading state when adding a car", async () => {
    render(
      <MockedProvider mocks={[addCarMock]} addTypename={true}>
        <AddCarForm />
      </MockedProvider>
    );

    fireEvent.change(screen.getByLabelText(/make/i), {
      target: { value: "Tesla" },
    });
    fireEvent.change(screen.getByLabelText(/model/i), {
      target: { value: "Model S" },
    });
    fireEvent.change(screen.getByLabelText(/year/i), {
      target: { value: "2022" },
    });
    fireEvent.change(screen.getByLabelText(/color/i), {
      target: { value: "Red" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add car/i }));

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
