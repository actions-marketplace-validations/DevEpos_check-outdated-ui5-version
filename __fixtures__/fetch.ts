/* eslint-disable @typescript-eslint/no-explicit-any */
export function mockNodeFetch() {
  const fetchMock = jest.fn();

  function mockFetchResponse(result: unknown) {
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        json: () => Promise.resolve(result)
      })
    );
  }
  global.fetch = fetchMock as any;

  return {
    mock: fetchMock,
    mockFetchResponse
  };
}
