const test = require("node:test");
const assert = require("node:assert/strict");
const { createEventDispatcher } = require("../src/event-dispatcher");

function mockIo() {
  const emitted = [];
  return {
    to(room) {
      return {
        emit(eventName, data) {
          emitted.push({ room, eventName, data });
        },
      };
    },
    getEmitted: () => emitted,
  };
}

test("event-dispatcher: broadcasts ORDER_CREATED to kitchen room", () => {
  const io = mockIo();
  const dispatcher = createEventDispatcher(io);

  const message = {
    event: "ORDER_CREATED",
    orderId: "ord_101",
    restaurantId: "rest_alpha",
    tableId: "tab_1",
    tableSessionId: "sess_1",
    total: 350,
  };

  const ok = dispatcher.dispatch(JSON.stringify(message));
  assert.equal(ok, true);

  const emitted = io.getEmitted();
  const kitchenEmits = emitted.filter((e) => e.room === "kitchen:rest_alpha");
  assert.ok(kitchenEmits.some((e) => e.eventName === "kitchen_new_order"));
  assert.ok(kitchenEmits.some((e) => e.eventName === "kitchen_event"));
});

test("event-dispatcher: broadcasts ORDER_STATUS_CHANGED to kitchen and table rooms", () => {
  const io = mockIo();
  const dispatcher = createEventDispatcher(io);

  const message = {
    event: "ORDER_STATUS_CHANGED",
    orderId: "ord_101",
    restaurantId: "rest_alpha",
    tableSessionId: "sess_1",
    previousStatus: "ACCEPTED",
    newStatus: "PREPARING",
  };

  const ok = dispatcher.dispatch(message);
  assert.equal(ok, true);

  const emitted = io.getEmitted();
  const kitchenEmits = emitted.filter((e) => e.room === "kitchen:rest_alpha");
  const tableEmits = emitted.filter((e) => e.room === "table:sess_1");

  assert.ok(kitchenEmits.some((e) => e.eventName === "kitchen_order_updated" && e.data.newStatus === "PREPARING"));
  assert.ok(tableEmits.some((e) => e.eventName === "order_status_updated" && e.data.newStatus === "PREPARING"));
});

test("event-dispatcher: broadcasts ORDER_PAID to kitchen and table rooms", () => {
  const io = mockIo();
  const dispatcher = createEventDispatcher(io);

  const message = {
    event: "ORDER_PAID",
    orderId: "ord_101",
    restaurantId: "rest_alpha",
    tableSessionId: "sess_1",
    amount: 500,
  };

  const ok = dispatcher.dispatch(message);
  assert.equal(ok, true);

  const emitted = io.getEmitted();
  assert.ok(emitted.some((e) => e.room === "kitchen:rest_alpha" && e.eventName === "kitchen_order_paid"));
  assert.ok(emitted.some((e) => e.room === "table:sess_1" && e.eventName === "order_paid"));
});

test("event-dispatcher: gracefully ignores malformed payload", () => {
  const io = mockIo();
  const dispatcher = createEventDispatcher(io);

  assert.equal(dispatcher.dispatch("not-json"), false);
  assert.equal(dispatcher.dispatch({}), false);
  assert.equal(io.getEmitted().length, 0);
});

