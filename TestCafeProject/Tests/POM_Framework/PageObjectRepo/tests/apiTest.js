//https://jsonplaceholder.typicode.com/

fixture`request`;
test("GET request", async (t) => {
  const results = await t.request({
    url: `https://jsonplaceholder.typicode.com/todos/1`,
    method: "GET",
  });

  console.log(results);
  await t.expect(results.body.title).eql("delectus aut autem");
  await t.expect(results.status).eql(200);
});