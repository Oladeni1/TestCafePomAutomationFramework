import { ClientFunction } from "testcafe";
import HomePage from "../Pages/HomePage";
import LoginPage from "../Pages/LoginPage";

const loginurl = 'https://the-internet.herokuapp.com/login'
const homeurl = 'https://the-internet.herokuapp.com/secure'
const getUrl = ClientFunction(() => window.location.href);

fixture('Home Page')
.page(loginurl)
.beforeEach(async t =>{

    LoginPage.setUsername ('tomsmith')
    LoginPage.setPassword('SuperSecretPassword!')
    LoginPage.clickLoginbtn()

    await t.wait(5000)

})

test('Loading home Page', async t =>{

    await t
    .expect(getUrl()).contains(homeurl)
    .expect(HomePage.logoutBtn.exists).ok()

});

