import { Component, OnInit, Inject, ViewChild } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { SpreadsheetDialogData, OntologyInformationsDialogData, ConnectorDialogData } from 'src/app/models/dialog-data.model';
import { OntologyService } from 'src/app/services/ontology/ontology.service';
import { OntologyParameter } from 'src/app/models/ontology-parameter.model';
import { SocketService } from 'src/app/services/socket/socket.service';
import { StudyUpdateParameter, UpdateParameterType } from 'src/app/models/study-update.model';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { StudyCaseLocalStorageService } from 'src/app/services/study-case-local-storage/study-case-local-storage.service';
import { SnackbarService } from 'src/app/services/snackbar/snackbar.service';
import { StudyCaseDataService } from 'src/app/services/study-case/data/study-case-data.service';
import { IoType, WidgetType } from 'src/app/models/node-data.model';
import { LoadingDialogService } from 'src/app/services/loading-dialog/loading-dialog.service';
import { TypeConversionTools } from 'src/app/tools/type-conversion.tool';
import { SoSTradesError } from 'src/app/models/sos-trades-error.model';
import { DataManagementDiscipline } from 'src/app/models/data-management-discipline.model';
import { SpreadsheetComponent } from '../../spreadsheet/spreadsheet.component';
import { StudyCaseMainService } from 'src/app/services/study-case/main/study-case-main.service';
import { ConnectorDataComponent } from '../../connector-data/connector-data.component';

@Component({
  selector: 'app-ontology-informations',
  templateUrl: './ontology-informations.component.html',
  styleUrls: ['./ontology-informations.component.scss']
})
export class OntologyInformationsComponent implements OnInit {

  @ViewChild(MatSort, { static: false })
  set sort(v: MatSort) {
    this.dataSourceChanges.sort = v;
  }

  public iotype = IoType;

  public isEditableOnAnotherNode: boolean;
  public originNamespace: string;

  public originDisciplines: DataManagementDiscipline[];

  public parameterName: string;
  public changesList: StudyUpdateParameter[];
  public isLoading: boolean;
  public infoList: string[][];
  public displayedColumns = ['oldValue', 'author', 'lastModified', 'revert'];
  public dataSourceChanges = new MatTableDataSource<StudyUpdateParameter>();

  public keys = Object.keys;
  public ontologyInstance: OntologyParameter;

  constructor(
    private dialog: MatDialog,
    private loadingDialogService: LoadingDialogService,
    private studyCaseDataService: StudyCaseDataService,
    private studyCaseMainService: StudyCaseMainService,
    private studyCaseLocalStorageService: StudyCaseLocalStorageService,
    private snackbarService: SnackbarService,
    private socketService: SocketService,
    private ontologyService: OntologyService,
    public dialogRef: MatDialogRef<OntologyInformationsComponent>,
    @Inject(MAT_DIALOG_DATA) public data: OntologyInformationsDialogData) {
    this.parameterName = null;
    this.isLoading = true;
    this.infoList = [];
    this.changesList = [];
    this.originDisciplines = [];
    this.isEditableOnAnotherNode = false;
    this.originNamespace = '';
  }

  ngOnInit(): void {

    this.data.nodeData.disciplineFullPathList.forEach(modelFullPath => {
      const newDataM: DataManagementDiscipline = new DataManagementDiscipline();
      newDataM.modelNameFullPath.push(modelFullPath);
      this.originDisciplines.push(newDataM);
    });

    // Retrieve ontology information
    if (this.ontologyService.getParameter(this.data.displayName) !== null) {
      this.ontologyInstance = this.ontologyService.getParameter(this.data.displayName);
      this.infoList = Object.entries(this.ontologyService.getParameter(this.data.displayName))
        .filter(entry => typeof entry[1] === 'string').map(entry => [OntologyParameter.getKeyLabel(entry[0]), entry[1]]);
      this.parameterName = this.ontologyService.getParameter(this.data.displayName).label;
    }
    // Retrieve variable changes
    this.changesList = this.socketService.getParameterChangesList(this.data.name);
    this.dataSourceChanges = new MatTableDataSource<StudyUpdateParameter>(this.changesList);
    this.dataSourceChanges.sortingDataAccessor = (item, property) => {
      return typeof item[property] === 'string' ? item[property].toLowerCase() : item[property];
    };
    this.dataSourceChanges.sort = this.sort;
    // Checking if variable is editable on another node
    if (this.data.nodeData.ioType !== IoType.OUT && this.data.nodeData.isDataDisc) {
      const varNamespaceList = this.data.nodeData.identifier.split('.');
      if (varNamespaceList !== undefined && varNamespaceList !== null && varNamespaceList.length > 1) {
        // Removing var name and recreate node namespace of variable
        varNamespaceList.pop();
        const dataNamespace = varNamespaceList.join('.');

        if (dataNamespace !== this.data.nodeData.parent.fullNamespace) {
          if (this.data.nodeData.identifier in this.studyCaseDataService.loadedStudy.treeview.rootNodeDataDict
            && this.studyCaseDataService.loadedStudy.treeview.rootNodeDataDict[this.data.nodeData.identifier].ioType !== IoType.OUT
            && (this.studyCaseDataService.loadedStudy.treeview.rootNodeDataDict[this.data.nodeData.identifier].editable === true
              || this.studyCaseDataService.loadedStudy.treeview.rootNodeDataDict[this.data.nodeData.identifier].connector_data !== undefined)) {
            this.isEditableOnAnotherNode = true;
            this.originNamespace = dataNamespace;
          }
        }
      } else {
        this.isEditableOnAnotherNode = false;
      }
    } else if (this.data.nodeData.ioType !== IoType.OUT && !this.data.nodeData.isDataDisc && this.data.nodeData.editable === false) {
      this.isEditableOnAnotherNode = false;
    }

    this.data.nodeData.parent.fullNamespace;
    this.isLoading = false;
  }

  goToEditableWidget() {
    this.dialogRef.close();
    this.studyCaseDataService.onTreeNodeNavigation.emit(this.studyCaseDataService.loadedStudy.treeview.rootNodeDataDict[this.data.nodeData.identifier]);
  }

  revertChanges(parameter: StudyUpdateParameter) {

    if (parameter.changeType == UpdateParameterType.SCALAR) {
      this.revertStringType(parameter);
    } else if (parameter.changeType == UpdateParameterType.CSV) {
      this.revertCsvType(parameter);
    } else if (parameter.changeType == UpdateParameterType.CONNECTOR_DATA) {
      this.revertConnectorDataType(parameter);
    }
  }

  revertStringType(parameter: StudyUpdateParameter) {
    const newUpdateParameter = new StudyUpdateParameter(
      parameter.variableId,
      parameter.variableType,
      UpdateParameterType.SCALAR,
      this.data.namespace,
      this.data.discipline,
      parameter.oldValue,
      this.data.nodeData.value,
      null,
      new Date());

    this.studyCaseLocalStorageService.setStudyParametersInLocalStorage(
      newUpdateParameter,
      this.data.nodeData.identifier,
      this.studyCaseDataService.loadedStudy.studyCase.id.toString());

    this.data.nodeData.value = newUpdateParameter.newValue;

    if (this.data.nodeData.widgetType === WidgetType.TABLE_WIDGET) {
      // Emit node data change event to table and table list list, to update widget
      this.studyCaseLocalStorageService.onNodeDataChange.emit(this.data.nodeData.identifier);
    }
    this.dialogRef.close();
    this.snackbarService.showInformation(`${this.data.nodeData.displayName} data reverted to date : ${parameter.lastModified}`);
  }

  revertConnectorDataType(parameter: StudyUpdateParameter) {
    const newUpdateParameter = new StudyUpdateParameter(
      parameter.variableId,
      parameter.variableType,
      UpdateParameterType.CONNECTOR_DATA,
      this.data.namespace,
      this.data.discipline,
      parameter.oldValue,
      this.data.nodeData.connector_data,
      null,
      new Date());
    console.log(newUpdateParameter)
    this.studyCaseLocalStorageService.setStudyParametersInLocalStorage(
      newUpdateParameter,
      this.data.nodeData.identifier,
      this.studyCaseDataService.loadedStudy.studyCase.id.toString());

    this.data.nodeData.connector_data = newUpdateParameter.newValue;

    if (this.data.nodeData.widgetType === WidgetType.TABLE_WIDGET) {
      // Emit node data change event to table and table list list, to update widget
      this.studyCaseLocalStorageService.onNodeDataChange.emit(this.data.nodeData.identifier);
    }
    this.dialogRef.close();
    this.snackbarService.showInformation(`${this.data.nodeData.displayName} data reverted to date : ${parameter.lastModified}`);
  }

  revertCsvType(parameter: StudyUpdateParameter) {

    this.loadingDialogService.showLoading(`Retrieving parameter data : ${parameter.variableId}`);
    this.studyCaseDataService.getChangeFile(parameter.variableId, parameter.id).subscribe(arrayBufferFile => {

      const blobData = new Blob([arrayBufferFile]);

      const reader = new FileReader();
      reader.readAsDataURL(blobData);
      reader.onloadend = (ev) => {
        const base64String = reader.result;

        const newUpdateParameter = new StudyUpdateParameter(
          parameter.variableId,
          parameter.variableType,
          UpdateParameterType.CSV,
          this.data.namespace,
          this.data.discipline,
          base64String,
          null,
          null,
          new Date());

        this.studyCaseLocalStorageService.setStudyParametersInLocalStorage(
          newUpdateParameter,
          this.data.nodeData.identifier,
          this.studyCaseDataService.loadedStudy.studyCase.id.toString());

        this.data.nodeData.value = newUpdateParameter.newValue;
        this.loadingDialogService.closeLoading();
        this.dialogRef.close();
        this.snackbarService.showInformation(`${this.data.nodeData.displayName} data reverted to date : ${parameter.lastModified}`);
      };
    }, errorReceived => {
      const error = errorReceived as SoSTradesError;
      this.loadingDialogService.closeLoading();
      if (error.redirect) {
        this.snackbarService.showError(error.description);
      } else {
        this.snackbarService.showError('Error reverting csv file : ' + error.description);
      }
    });
  }

  onShowCsvChange(parameter: StudyUpdateParameter) {
    this.loadingDialogService.showLoading(`Loading csv file : ${parameter.variableId}.csv`);
    this.studyCaseDataService.getChangeFile(parameter.variableId, parameter.id).subscribe(arrayBufferFile => {

      const spreadsheetDialogData: SpreadsheetDialogData = new SpreadsheetDialogData();
      spreadsheetDialogData.title = parameter.variableId;
      spreadsheetDialogData.file = new Blob([arrayBufferFile]);
      spreadsheetDialogData.nodeData = this.data.nodeData;
      spreadsheetDialogData.readOnly = true;

      const dialogRef = this.dialog.open(SpreadsheetComponent, {
        disableClose: true,
        data: spreadsheetDialogData
      });
      this.loadingDialogService.closeLoading();
    }, errorReceived => {
      const error = errorReceived as SoSTradesError;
      this.loadingDialogService.closeLoading();
      if (error.redirect) {
        this.snackbarService.showError(error.description);
      } else {
        this.snackbarService.showError('Error retrieving csv file : ' + error.description);
      }
    })
  }

  onShowCsvCurrentValue() {
    let name = '';

    if (this.ontologyService.getParameter(this.data.nodeData.displayName) !== null
      && this.ontologyService.getParameter(this.data.nodeData.displayName) !== undefined) {
      if (this.ontologyService.getParameter(this.data.nodeData.displayName).label !== null
        && this.ontologyService.getParameter(this.data.nodeData.displayName).label !== undefined) {
        name = this.ontologyService.getParameter(this.data.nodeData.displayName).label;
      }
    }

    if (name === null || name === '') {
      name = this.data.nodeData.displayName;
    }

    const spreadsheetDialogData: SpreadsheetDialogData = new SpreadsheetDialogData();
    spreadsheetDialogData.title = name;
    spreadsheetDialogData.readOnly = true;
    spreadsheetDialogData.nodeData = this.data.nodeData;

    let isListType = false;
    if (this.data.nodeData.type.includes('list')) {
      isListType = true;
    }

    if (isListType) {
      this.loadingDialogService.showLoading(`Loading list : ${name}`);

      const dialogRef = this.dialog.open(SpreadsheetComponent, {
        disableClose: true,
        data: spreadsheetDialogData
      });
      this.loadingDialogService.closeLoading();

    } else {
      this.loadingDialogService.showLoading(`Loading csv file : ${name}.csv`);

      const updateParameter = this.studyCaseLocalStorageService.
        getOneStudyParameterFromLocalStorage(this.studyCaseDataService.loadedStudy.studyCase.id.toString(), this.data.nodeData.identifier);

      if (updateParameter !== null) { // Temporay file in local storage
        spreadsheetDialogData.file = TypeConversionTools.b64StringToBlob(updateParameter.newValue);
        const dialogRef = this.dialog.open(SpreadsheetComponent, {
          disableClose: true,
          data: spreadsheetDialogData
        });
        this.loadingDialogService.closeLoading();
      } else { // File in distant server
        this.studyCaseMainService.getFile(this.data.nodeData.identifier).subscribe(file => {
          spreadsheetDialogData.file = new Blob([file]);;
          const dialogRef = this.dialog.open(SpreadsheetComponent, {
            disableClose: true,
            data: spreadsheetDialogData
          });
          this.loadingDialogService.closeLoading();
        }, errorReceived => {
          const error = errorReceived as SoSTradesError;
          this.loadingDialogService.closeLoading();
          if (error.redirect) {
            this.snackbarService.showError(error.description);
          } else {
            this.snackbarService.showError('Error loading csv file : ' + error.description);
          }
        });
      }
    }
  }

  onShowConnectorData() {
    const connectorDialogData: ConnectorDialogData = new ConnectorDialogData()
    connectorDialogData.parameterName = this.data.nodeData.displayName;
    connectorDialogData.connectorData = this.data.nodeData.connector_data;
    connectorDialogData.nodeData = this.data.nodeData;
    connectorDialogData.namespace = this.data.namespace;
    connectorDialogData.discipline = this.data.discipline;

    const dialogRef = this.dialog.open(ConnectorDataComponent, {
      disableClose: true,
      data: connectorDialogData
    });
  }

  onShowConnectorChange(updateParameter: StudyUpdateParameter) {
    const connectorDialogData: ConnectorDialogData = new ConnectorDialogData()

    connectorDialogData.parameterName = this.data.nodeData.displayName;
    connectorDialogData.connectorData = updateParameter.oldValue;
    connectorDialogData.nodeData = this.data.nodeData;
    connectorDialogData.namespace = this.data.namespace;
    connectorDialogData.discipline = this.data.discipline;
    connectorDialogData.isReadOnly = true;

    const dialogRef = this.dialog.open(ConnectorDataComponent, {
      disableClose: true,
      data: connectorDialogData
    });
  }

  okClick() {
    this.dialogRef.close();
  }

}
