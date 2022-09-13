import {Selector, t} from 'testcafe';

class LoginPage{

    constructor(){

      this.usernameField = Selector ('#username');
      this.passwordField = Selector ('#password');
      this.loginBtn = Selector ('button').withText('Login');
      this. loginPageHeaderText = Selector ('h2').withText('Login Page');
      this. successLogoutMessage = Selector ('div#flash');
      this. errorMessageUname = Selector ('div').withText('Your username is invalid!');
      this. errorMessagePwd = Selector ('div').withText('Your password is invalid!');
      
    }
    
    async setUsername(validUsername){
      await t
      .typeText(this.usernameField, validUsername)
    }

    async setPassword(validPassword){
      await t
      .typeText(this.passwordField, validPassword)
    }

    async clickLoginbtn(){
      await t
      .click(this.loginBtn)
    }

}
export default  new LoginPage();