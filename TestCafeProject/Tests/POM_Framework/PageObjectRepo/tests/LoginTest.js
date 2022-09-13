import { ClientFunction } from "testcafe";
import HomePage from "../Pages/HomePage";
import LoginPage from "../Pages/LoginPage";

const url = 'https://the-internet.herokuapp.com/login'
const getUrl = ClientFunction(() => window.location.href);

fixture('Login Page')
.page(url)


test('Loading Login Page', async t =>{
    await t
    .maximizeWindow()
    .expect(getUrl()).contains(url)
    .expect(LoginPage.loginBtn.exists).ok()

});
test('Successful Login - Valid credential', async t =>{
    await t
    .maximizeWindow()
    LoginPage.setUsername ('tomsmith')
    LoginPage.setPassword('SuperSecretPassword!')
    LoginPage.clickLoginbtn()
    await t.wait(5000)
    .expect(HomePage.successMessage.exists).ok()
    await t.wait(5000)
    .expect(HomePage.headerText.exists).ok()
    await t.wait(5000)
    .expect(HomePage.subHeaderText.exists).ok()

});
test('Unsuccessful Login - Invalid Username', async t =>{
    await t
    .maximizeWindow()
    LoginPage.setUsername ('TesterOla')
    LoginPage.setPassword('uperSecretPassword!')
    LoginPage.clickLoginbtn()
    await t.wait(5000)
    .expect(LoginPage.errorMessageUname.exists).ok()
    
});
test('Unsuccessful Login - Invalid Password', async t =>{
    await t
    .maximizeWindow()
    LoginPage.setUsername ('tomsmith')
    LoginPage.setPassword('TestOla')
    LoginPage.clickLoginbtn()
    await t.wait(5000)
    .expect(LoginPage.errorMessagePwd.exists).ok()
    
});

