import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { SoSTradesError } from 'src/app/models/sos-trades-error.model';
import { SnackbarService } from 'src/app/services/snackbar/snackbar.service';
import { AppDataService } from 'src/app/services/app-data/app-data.service';
import { SamlService } from 'src/app/services/saml/saml.service';
import { LoggerService } from 'src/app/services/logger/logger.service';
import { StudyCaseLocalStorageService } from 'src/app/services/study-case-local-storage/study-case-local-storage.service';
import { RoutingState } from 'src/app/services/routing-state/routing-state.service';


@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  error: SoSTradesError;
  public loadingLogin: boolean;
  public platform: string;
  public showLogin: boolean;
  public ssoUrl: string;
  private autoLogon: boolean;

  loginForm = new FormGroup({
    username: new FormControl('', Validators.required),
    password: new FormControl('', Validators.required)
  });

  constructor(
    private auth: AuthService,
    private studyCaseLocalStorage: StudyCaseLocalStorageService,
    private samlService: SamlService,
    private routingState: RoutingState,
    private appDataService: AppDataService,
    private router: Router,
    private route: ActivatedRoute,
    private snackbarService: SnackbarService,
    private dialog: MatDialog,
    private loggerService: LoggerService) {
    this.loadingLogin = false;
    this.platform = '';
    this.showLogin = false;
    this.ssoUrl = '';
    this.autoLogon = false;
  }

  ngOnInit() {

    // Clean local storage from study requested if reloading page and not redirection from study link

    if (this.routingState.getPreviousUrl() !== null
      && this.routingState.getPreviousUrl() !== undefined
      && !this.routingState.getPreviousUrl().includes('/study/')) {
      this.studyCaseLocalStorage.removeStudyUrlRequestedFromLocalStorage();
    }

    this.dialog.closeAll();

    this.route.queryParams.subscribe(params => {
      if (params.hasOwnProperty('autologon')) {
        this.autoLogon = true;
      }
      this.loggerService.log(`autologon : ${this.autoLogon}`);

      this.appDataService.getAppInfo().subscribe(res => {
        if (res !== null && res !== undefined) {
          this.platform = res['platform'];

          this.samlService.getSSOUrl().subscribe(ssoUrl => {
            this.ssoUrl = ssoUrl;

            if (this.autoLogon === true && this.ssoUrl !== '') {
              document.location.href = this.ssoUrl;
            } else {
              this.showLogin = true;
            }
          },
            error => {
              this.ssoUrl = '';
              this.showLogin = true;
            });
        }
      }, errorReceived => {
        this.showLogin = true;
        const error = errorReceived as SoSTradesError;
        if (error.redirect) {
          this.snackbarService.showError(error.description);
        } else {
          this.snackbarService.showError('Error getting application info : ' + error.description);
        }
      });
    },
      error => {
        this.loggerService.log(error);
        this.snackbarService.showError(error.description);
        if (!error.redirect) {
          this.router.navigate(['/login']);
        }
      });
  }

  submit() {
    this.loadingLogin = true;
    const username = this.loginForm.get('username').value;
    const password = this.loginForm.get('password').value;
    this.auth.authenticate(username, password).subscribe(
      () => {
        this.snackbarService.closeSnackbarIfOpened();

        // Retrieving study access url if it exists and rerouting if appropriated
        const studyUrlRequested = this.studyCaseLocalStorage.getStudyUrlRequestedFromLocalStorage();

        if (studyUrlRequested !== null && studyUrlRequested !== undefined && studyUrlRequested.length > 0) {
          this.router.navigate([studyUrlRequested]);
        } else {
          this.router.navigate(['/models-status']);
        }
        this.studyCaseLocalStorage.removeStudyUrlRequestedFromLocalStorage();
        this.loadingLogin = false;

      },
      (err) => {
        this.snackbarService.showError('Error at login : ' + err);
        this.loadingLogin = false;
      }
    );
  }

  loginWithSSO() {
    this.samlService.loginWithSSO();
  }
}