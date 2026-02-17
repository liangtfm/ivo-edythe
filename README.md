# Strive take home

# Goal

Create a real-time heatmap of 10000 sensors with the ability for the user to take action on one or more sensors.

# Setup

Install [bun](https://bun.com/)

```
bun install

bun generate-mock-data

bun dev
```

# Technologies

- [NextJS](https://nextjs.org/)
- [shadcn](https://ui.shadcn.com/)
- [Tailwind](https://tailwindcss.com/)
- [MapLibre](https://github.com/maplibre/maplibre-gl-js)
- [AG Grid](https://www.ag-grid.com/react-data-grid/getting-started/)

# Approach

My initial idea was to set up a quick map view with the sensor data as point on the map that the user can click. Since the task was to create something for non-technical users, I figured a map with color-coded points for the sensors would be an easy way for a user to assess the current health of sensors in a macro view. For taking actions, I chose to use a data table to display the sensor data and allow the user to easily filter/select sensors to perform actions on. Since the current approach is a manual spreadsheet, a data table should feel familiar.

I set up the endpoints I needed and the script to create some mock data (10000 sensors), then called that on the frontend to make sure it worked. I chose `MapLibre` since it's free and `maptiler` since it has a free tier. I was planning to use an SSE connection to get "real-time" updates which I would batch update with MapLibre. My thought was to use a `setInterval` (starting at around 1s to test, planning to adjust faster after) that would check for any updates that came in from our SSE connection and then update the sensor data and call `map.setData()`. This should have been enough to prevent any laggy UI.

Setting up the map took longer than anticipated, so I jumped to setting up the "Actions" section. This is where I wanted to use `AG Grid` to display the data and allow the user to select sensors to perform actions on. I chose `AG Grid` because it is a very performant and battle-tested table library and has the features I needed like filtering so the user could technically filter by sensors with `error` status and perform an action.

# Scaling

My initial approach was just to use MapLibre to render the 10000 sensors and I think this would have been fine. As we scale for a real-world situation, we would most likely need to implement a tiling solution in the backend so that we only fetch/update for whatever is visible in the map view. I think some of the other recommended libraries mentioned in the doc like `Deck.gl` would play a part since they seemed to be more performant ways to render large amounts of data, but given the time constraint and no experience with those libraries I opted to go with a simpler approach.
