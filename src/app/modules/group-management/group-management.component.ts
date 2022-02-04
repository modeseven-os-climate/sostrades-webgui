import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormControl, Validators, ValidatorFn, AbstractControl, FormGroup } from '@angular/forms';
import { GroupDataService } from 'src/app/services/group/group-data.service';
import { MatTableDataSource } from '@angular/material/table';
import { Group, LoadedGroup } from 'src/app/models/group.model';
import { SnackbarService } from 'src/app/services/snackbar/snackbar.service';
import { UpdateEntityRightDialogData, ValidationDialogData } from 'src/app/models/dialog-data.model';
import { MatDialog } from '@angular/material/dialog';
import { LoadingDialogService } from 'src/app/services/loading-dialog/loading-dialog.service';
import { ValidationDialogComponent } from 'src/app/shared/validation-dialog/validation-dialog.component';
import { SoSTradesError } from 'src/app/models/sos-trades-error.model';
import { MatSort } from '@angular/material/sort';
import { EntityResourceRights } from 'src/app/models/entity-right.model';
import { UpdateEntityRightComponent } from '../entity-right/update-entity-right/update-entity-right.component';
import { EntityRightService } from 'src/app/services/entity-right/entity-right.service';
import { HostListener } from '@angular/core';
import { TypeCheckingTools } from 'src/app/tools/type-checking.tool';


@Component({
  selector: 'app-group-management',
  templateUrl: './group-management.component.html',
  styleUrls: ['./group-management.component.scss']
})

export class GroupManagementComponent implements OnInit {

  public createGroupForm: FormGroup;
  public checkboxConfidential: boolean;
  public isLoading: boolean;
  public displayedColumnsMyGroups = ['name', 'description', 'confidential', 'users', 'delete'];
  public colummnsFilter = ['All columns', 'Group Name', 'Description'];
  public dataSourceMyGroups = new MatTableDataSource<LoadedGroup>();

  @ViewChild(MatSort, { static: false })
  set sort(v: MatSort) {
    this.dataSourceMyGroups.sort = v;
  }

  @ViewChild('filter', { static: true }) private filterElement: ElementRef;

  @HostListener('document:keydown.control.f', ['$event']) onKeydownHandler(event: KeyboardEvent) {
    // Check group component is visible
    if (this.elementRef.nativeElement.offsetParent !== null) {
      // Set focus and select all text in filter
      this.filterElement.nativeElement.focus();
      this.filterElement.nativeElement.setSelectionRange(0, this.groupDataService.groupManagementFilter.length);
      event.preventDefault();
    }
  }

  constructor(
    private elementRef: ElementRef,
    private dialog: MatDialog,
    public groupDataService: GroupDataService,
    private entityRightService: EntityRightService,
    private loadingDialogService: LoadingDialogService,
    private snackbarService: SnackbarService) {
    this.isLoading = true;
    this.checkboxConfidential = false;
  }

  ngOnInit(): void {

    this.createGroupForm = new FormGroup({
      groupName: new FormControl('', [Validators.required, Validators.pattern(TypeCheckingTools.TEXT_LETTER_NUMBER_REGEX)]),
      groupDescription: new FormControl('', [Validators.required])
    });

    // Load data first time component initialised
    if (this.groupDataService.groupManagementData === null
      || this.groupDataService.groupManagementData === undefined
      || this.groupDataService.groupManagementData.length === 0) {
      this.loadGroupManagementData();
    } else {
      this.dataSourceMyGroups = new MatTableDataSource<LoadedGroup>(
        this.groupDataService.groupManagementData
      );
      this.dataSourceMyGroups.sortingDataAccessor = (item, property) => {
        switch (property) {
          case 'name':
            return typeof item.group.name === 'string' ? item.group.name.toLowerCase() : item.group.name;
          case 'description':
            return typeof item.group.description === 'string' ? item.group.description.toLowerCase() : item.group.name;
          case 'confidential':
            return typeof item.group.confidential;
          default:
            return typeof item[property] === 'string' ? item[property].toLowerCase() : item[property];
        }
      };
      this.dataSourceMyGroups.sort = this.sort;
      // Initialising filter with 'All columns'
      this.onFilterChange();
      this.isLoading = false;
    }
  }

  loadGroupManagementData() {

    this.isLoading = true;
    this.groupDataService.groupManagementData = [];
    this.dataSourceMyGroups = new MatTableDataSource<LoadedGroup>(null);

    this.groupDataService.getUserGroups().subscribe(grpList => {
      grpList.forEach(group => {
        this.groupDataService.groupManagementData.push(group);
      });
      this.dataSourceMyGroups = new MatTableDataSource<LoadedGroup>(this.groupDataService.groupManagementData);
      this.dataSourceMyGroups.sortingDataAccessor = (item, property) => {
        switch (property) {
          case 'name':
            return typeof item.group.name === 'string' ? item.group.name.toLowerCase() : item.group.name;
          case 'description':
            return typeof item.group.description === 'string' ? item.group.description.toLowerCase() : item.group.name;
          case 'confidential':
            return typeof item.group.confidential;
          default:
            return typeof item[property] === 'string' ? item[property].toLowerCase() : item[property];
        }
      };
      this.dataSourceMyGroups.sort = this.sort;
      this.onFilterChange();
      this.isLoading = false;
    }, errorReceived => {
      const error = errorReceived as SoSTradesError;
      if (error.redirect) {
        this.snackbarService.showError(error.description);
      } else {
        this.onFilterChange();
        this.isLoading = false;
        this.snackbarService.showError('Error loading user groups list : ' + error.description);
      }
    });
  }


  createGroup() {

    const groupName = this.createGroupForm.value.groupName;
    this.loadingDialogService.showLoading(`Creation of the Group "${groupName}". Please wait.`);
    // tslint:disable-next-line: max-line-length
    this.groupDataService.createGroup(this.createGroupForm.value.groupName, this.createGroupForm.value.groupDescription, this.checkboxConfidential).subscribe(res => {
      const newGroup: Group = res as Group;

      const newLoadedGroup = new LoadedGroup(res, true, false, false);
      this.groupDataService.groupManagementData.push(newLoadedGroup);
      this.dataSourceMyGroups = new MatTableDataSource<LoadedGroup>(this.groupDataService.groupManagementData);
      // Reset fields
      this.checkboxConfidential = false;
      this.createGroupForm.reset();

      // Reloading groups list
      this.groupDataService.loadAllGroups().subscribe(res => {
        this.onFilterChange();
        this.loadingDialogService.closeLoading();
        this.snackbarService.showInformation(`Group "${groupName}" has been successfully created.`);
      }, errorReceived => {
        const error = errorReceived as SoSTradesError;
        if (error.redirect) {
          this.loadingDialogService.closeLoading();
          this.snackbarService.showError(error.description);
        } else {
          this.onFilterChange();
          this.loadingDialogService.closeLoading();
          this.snackbarService.showError('Error reloading group list: ' + error.description);
        }
      });
    }, errorReceived => {
      const error = errorReceived as SoSTradesError;
      if (error.redirect) {
        this.loadingDialogService.closeLoading();
        this.snackbarService.showError(error.description);
      } else {
        this.onFilterChange();
        this.createGroupForm.controls.groupName.reset();
        this.loadingDialogService.closeLoading();
        this.snackbarService.showError('Error creating group : ' + error.description);
      }
    });
  }


  public hasError = (controlName: string, errorName: string) => {
    return this.createGroupForm.controls[controlName].hasError(errorName);
  }


  deleteGroup(group: Group) {

    const validationDialogData = new ValidationDialogData();
    // tslint:disable-next-line: max-line-length
    validationDialogData.message = `You are about to delete the Group (${group.name}). This will also delete the studies in this group, are you sure you want to proceed ?`;
    validationDialogData.buttonOkText = 'Delete';

    const dialogRefValidate = this.dialog.open(ValidationDialogComponent, {
      disableClose: true,
      width: '500px',
      height: '220px',
      data: validationDialogData
    });

    dialogRefValidate.afterClosed().subscribe(result => {
      const validationData: ValidationDialogData = result as ValidationDialogData;

      if ((validationData !== null) && (validationData !== undefined)) {
        if (validationData.cancel === false) {
          this.loadingDialogService.showLoading(`Deletion of the Group (${group.name}). Please wait.`);
          this.groupDataService.deleteGroup(group.id).subscribe(res => {
            this.groupDataService.groupManagementData = this.groupDataService.groupManagementData.filter(x => x.group.id !== group.id);
            this.dataSourceMyGroups = new MatTableDataSource<LoadedGroup>(this.groupDataService.groupManagementData);

            // Reloading groups list
            this.groupDataService.loadAllGroups().subscribe(res => {
              this.loadingDialogService.closeLoading();
              this.snackbarService.showInformation(`Group (${group.name}) has been succesfully deleted`);
            }, errorReceived => {
              const error = errorReceived as SoSTradesError;
              if (error.redirect) {
                this.loadingDialogService.closeLoading();
                this.snackbarService.showError(error.description);
              } else {
                this.loadingDialogService.closeLoading();
                this.snackbarService.showError('Error reloading group list: ' + error.description);
              }
            });
          }, errorReceived => {
            if (errorReceived.redirect === false) {
              this.loadingDialogService.closeLoading();
              this.snackbarService.showError(errorReceived.description);
            }
          });
        }
      }
    });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSourceMyGroups.filter = filterValue.trim().toLowerCase();
  }

  applyFilterAfterReloading() {
    this.dataSourceMyGroups.filter = this.groupDataService.groupManagementFilter.trim().toLowerCase();
  }

  onFilterChange() {
    this.dataSourceMyGroups.filterPredicate = (data: LoadedGroup, filter: string): boolean => {

      switch (this.groupDataService.groupManagementColumnFiltered) {
        case 'Group Name':
          return data.group.name.trim().toLowerCase().includes(filter);
        case 'Description':
          return data.group.description.trim().toLowerCase().includes(filter);
        default:
          return data.group.name.trim().toLowerCase().includes(filter) ||
            data.group.description.trim().toLowerCase().includes(filter);
      }
    };
    this.applyFilterAfterReloading();
  }

  groupAccess(loadedGroup: LoadedGroup) {

    const updateProcessAccessDialogData = new UpdateEntityRightDialogData();
    updateProcessAccessDialogData.ressourceId = loadedGroup.group.id;
    updateProcessAccessDialogData.ressourceName = loadedGroup.group.name;
    updateProcessAccessDialogData.resourceType = EntityResourceRights.GROUP;
    updateProcessAccessDialogData.getEntitiesRightsFunction = this.entityRightService.getGroupEntitiesRights(loadedGroup.group.id);

    const dialogRef = this.dialog.open(UpdateEntityRightComponent, {
      disableClose: true,
      data: updateProcessAccessDialogData
    });
  }
}