import { Component, OnInit, OnDestroy } from '@angular/core';
import { StudyCaseDataService } from 'src/app/services/study-case/data/study-case-data.service';
import { Subscription } from 'rxjs';
import { LoadedStudy} from 'src/app/models/study.model';
import { Router } from '@angular/router';
import { HeaderService } from 'src/app/services/hearder/header.service';
import { NavigationTitle } from 'src/app/models/navigation-title.model';
import { Routing } from 'src/app/models/routing.model';
import { StudyCaseLocalStorageService } from 'src/app/services/study-case-local-storage/study-case-local-storage.service';
import { StudyCaseModificationDialogData, ValidationDialogData } from 'src/app/models/dialog-data.model';
import { ValidationDialogComponent } from 'src/app/shared/validation-dialog/validation-dialog.component';
import { StudyUpdateParameter } from 'src/app/models/study-update.model';
import { StudyCaseModificationDialogComponent} from '../study-case/study-case-modification-dialog/study-case-modification-dialog.component';
import { SocketService } from 'src/app/services/socket/socket.service';
import { MatDialog } from '@angular/material/dialog';
import { SnackbarService } from 'src/app/services/snackbar/snackbar.service';
import { StudyCaseMainService } from 'src/app/services/study-case/main/study-case-main.service';

@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
  styleUrls: ['./sidenav.component.scss'],
})
export class SidenavComponent implements OnInit, OnDestroy {

  private onStudyCaseChangeSubscription: Subscription;
  private onEditStudychangeSubscription: Subscription;
  private unSavedChangesSubscription: Subscription;
  public studyName: string;
  public isLoadedStudy: boolean;
  public loadedStudy: LoadedStudy;
  public hasUnsavedChanges: boolean;

  constructor(
    public studyCaseDataService: StudyCaseDataService,
    public studyCaseMainService: StudyCaseMainService,
    private headerService: HeaderService,
    private socketService: SocketService,
    private snackbarService: SnackbarService,
    private dialog: MatDialog,
    public studyCaseLocalStorageService: StudyCaseLocalStorageService,
    private router: Router) {
    this.onStudyCaseChangeSubscription = null;
    this.unSavedChangesSubscription = null;
    this.hasUnsavedChanges = false;
    this.studyName = '';
    this.isLoadedStudy = false;
  }

  ngOnInit() {

    this.onStudyCaseChangeSubscription = this.studyCaseDataService.onStudyCaseChange.subscribe(loadedStudyData => {
      this.loadedStudy = loadedStudyData as LoadedStudy;
      if (this.loadedStudy !== null && this.loadedStudy !== undefined) {
        this.studyName = this.loadedStudy.studyCase.name;
        this.isLoadedStudy = true;
        this.onClickTreeview(this.loadedStudy);
      } else {
        this.studyName = '';
        this.isLoadedStudy = false;
      }
    });
    this.studyCaseLocalStorageService.unsavedChanges.subscribe(
      unsavedChanges => {
        if (unsavedChanges) {
          this.hasUnsavedChanges = unsavedChanges;
        }
      });
  }

  ngOnDestroy() {
    if (this.onStudyCaseChangeSubscription !== null && (this.onStudyCaseChangeSubscription !== undefined)) {
      this.onStudyCaseChangeSubscription.unsubscribe();
      this.onStudyCaseChangeSubscription = null;
    }
    if (this.onEditStudychangeSubscription !== null && (this.onEditStudychangeSubscription !== undefined)) {
      this.onEditStudychangeSubscription.unsubscribe();
      this.onEditStudychangeSubscription = null;
    }
    if (this.unSavedChangesSubscription !== null && (this.unSavedChangesSubscription !== undefined)) {
      this.unSavedChangesSubscription.unsubscribe();
      this.unSavedChangesSubscription = null;
    }
  }

  onClickTreeview(loadedStudy: LoadedStudy) {
    this.router.navigate([Routing.STUDY_WORKSPACE], {queryParams: {studyId: `${loadedStudy.studyCase.id}`}});
    this.headerService.changeTitle(NavigationTitle.STUDY_WORKSPACE);
    }


  closeStudy(event : any) {
    event.stopPropagation();
    event.preventDefault();
    if (this.studyCaseLocalStorageService.studiesHaveUnsavedChanges()) {
        const validationDialogData = new ValidationDialogData();
        validationDialogData.message = `You have made unsaved changes in your study, handle changes?`;
        validationDialogData.buttonOkText = 'Save & Synchronise';
        validationDialogData.buttonSecondaryActionText = 'Delete changes';
        validationDialogData.secondaryActionConfirmationNeeded = true;
        const dialogRefValidate = this.dialog.open(ValidationDialogComponent, {
          disableClose: true,
          width: '500px',
          height: '220px',
          data: validationDialogData,
        });

        dialogRefValidate.afterClosed().subscribe((result) => {
          const validationData: ValidationDialogData = result as ValidationDialogData;
          if (validationData !== null && validationData !== undefined) {
            if (validationData.cancel !== true) {
              if (validationData.validate === true) {
                // Saving changes
                let studyParameters: StudyUpdateParameter[] = [];
                studyParameters = this.studyCaseLocalStorageService.getStudyParametersFromLocalStorage(
                  this.studyCaseLocalStorageService
                    .getStudyIdWithUnsavedChanges()
                    .toString()
                );

                const studyCaseModificatioDialogData = new StudyCaseModificationDialogData();
                studyCaseModificatioDialogData.changes = studyParameters;
                const dialogRefSave = this.dialog.open(
                  StudyCaseModificationDialogComponent,
                  {
                    disableClose: true,
                    width: '1100px',
                    height: '800px',
                    panelClass: 'csvDialog',
                    data: studyCaseModificatioDialogData,
                  }
                );

                dialogRefSave.afterClosed().subscribe((resultSave) => {
                  const resultData: StudyCaseModificationDialogData = resultSave as StudyCaseModificationDialogData;

                  if (resultData !== null && resultData !== undefined) {
                    if (resultData.cancel !== true) {
                      this.studyCaseLocalStorageService.saveStudyChanges(
                        this.studyCaseLocalStorageService
                          .getStudyIdWithUnsavedChanges()
                          .toString(),
                        resultData.changes,
                        false,

                        (isSaveDone) => {
                          if (isSaveDone) {
                            // Send socket notifications
                            // tslint:disable-next-line: max-line-length
                            this.socketService.saveStudy(
                              this.studyCaseLocalStorageService.getStudyIdWithUnsavedChanges(),
                              resultData.changes
                            );
                            this.studyCaseMainService.closeStudy(true);
                          } else {
                            this.studyCaseMainService.closeStudy(false);
                          }
                        }
                      );
                    } else {
                       this.studyCaseMainService.closeStudy(false);
                    }
                  }
                });
              } else {
                this.studyCaseLocalStorageService.removeStudiesFromLocalStorage();
                this.studyCaseMainService.closeStudy(true);
                this.snackbarService.showInformation('Changes successfully deleted');
              }
            }
          }
        });
      } else {
        this.studyCaseMainService.closeStudy(true);
      }
    }
}
