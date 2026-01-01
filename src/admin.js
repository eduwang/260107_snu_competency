import { auth, db, isAdmin } from './firebaseConfig.js';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  getDoc, 
  setDoc,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import Swal from 'sweetalert2';

let currentUser = null;
let allUsers = [];
let allData = [];
let selectedDataId = null;
let selectedUserId = null;

// 인증 상태 확인
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    
    // 관리자 권한 확인
    if (!isAdmin(user.uid)) {
      Swal.fire({
        icon: 'error',
        title: '접근 권한 없음',
        text: '관리자만 접근할 수 있는 페이지입니다.',
        confirmButtonText: '확인'
      }).then(() => {
        window.location.href = '/index.html';
      });
      return;
    }
    
    document.getElementById('userInfo').textContent = `👤 ${user.displayName || user.email} 님`;
    document.getElementById('logoutBtn').style.display = 'inline-block';
    
    // 초기 데이터 로드
    loadUsers();
    loadAllData();
    loadMenuSettings();
  } else {
    document.getElementById('userInfo').textContent = '🔐 로그인 후 이용해 주세요.';
    document.getElementById('logoutBtn').style.display = 'none';
    Swal.fire({
      icon: 'warning',
      title: '로그인이 필요합니다',
      text: '메인 페이지로 이동합니다.',
      confirmButtonText: '확인'
    }).then(() => {
      window.location.href = '/index.html';
    });
  }
});

// 메인으로 돌아가기 버튼
const backToMainBtn = document.getElementById('backToMainBtn');
if (backToMainBtn) {
  backToMainBtn.addEventListener('click', () => {
    window.location.href = '/index.html';
  });
}

// 로그아웃 버튼
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      window.location.href = '/index.html';
    } catch (error) {
      console.error('로그아웃 오류:', error);
      Swal.fire({
        icon: 'error',
        title: '로그아웃 실패',
        text: '로그아웃 중 오류가 발생했습니다.'
      });
    }
  });
}

// 탭 전환 기능
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // 모든 탭 버튼과 콘텐츠에서 active 제거
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // 클릭한 탭 버튼과 해당 콘텐츠에 active 추가
      button.classList.add('active');
      const targetContent = document.getElementById(`${targetTab}-tab`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// ==================== 사용자 관리 ====================

// 사용자 목록 불러오기
async function loadUsers() {
  try {
    const usersContainer = document.getElementById('usersList');
    usersContainer.innerHTML = '<p class="empty-message">사용자 목록을 불러오는 중...</p>';

    const querySnapshot = await getDocs(collection(db, 'users'));

    if (querySnapshot.empty) {
      usersContainer.innerHTML = '<p class="empty-message">등록된 사용자가 없습니다.</p>';
      return;
    }

    allUsers = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      allUsers.push({
        id: docSnap.id,
        ...data
      });
    });

    // 생성일 기준 정렬 (최신순)
    allUsers.sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });

    renderUsersList();
    
  } catch (error) {
    console.error('사용자 목록 불러오기 오류:', error);
    document.getElementById('usersList').innerHTML = '<p class="empty-message">사용자 목록을 불러오는 중 오류가 발생했습니다.</p>';
    Swal.fire({
      icon: 'error',
      title: '불러오기 실패',
      text: error.message || '사용자 목록을 불러오는 중 오류가 발생했습니다.'
    });
  }
}

// 사용자 목록 렌더링
function renderUsersList() {
  const usersContainer = document.getElementById('usersList');
  
  if (allUsers.length === 0) {
    usersContainer.innerHTML = '<p class="empty-message">등록된 사용자가 없습니다.</p>';
    return;
  }

  const usersHTML = allUsers.map(user => {
    const createdAt = user.createdAt?.toDate?.() || new Date();
    const linkedAt = user.linkedAt?.toDate?.();
    const isLinked = !!user.uid;
    
    return `
      <div class="user-item">
        <div class="user-info">
          <div class="user-name">${user.name || '이름 없음'}</div>
          <div class="user-details">
            소속: ${user.affiliation || '소속 없음'}<br>
            코드: <span class="user-code">${user.code}</span><br>
            생성일: ${createdAt.toLocaleString('ko-KR')}
            ${linkedAt ? `<br>연결일: ${linkedAt.toLocaleString('ko-KR')}` : ''}
          </div>
        </div>
        <div class="user-actions">
          <div class="user-status">
            <span class="status-badge ${isLinked ? 'status-linked' : 'status-pending'}">
              ${isLinked ? '✓ 연결됨' : '대기 중'}
            </span>
          </div>
          <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.id}', '${user.name || '사용자'}')">삭제</button>
        </div>
      </div>
    `;
  }).join('');

  usersContainer.innerHTML = usersHTML;
}

// 사용자 삭제 함수 (전역으로 등록)
window.deleteUser = async function(userId, userName) {
  const result = await Swal.fire({
    title: '사용자 삭제',
    html: `정말 <strong>${userName}</strong> 사용자를 삭제하시겠습니까?<br><small style="color: #ef4444;">이 작업은 되돌릴 수 없습니다.</small>`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '삭제',
    cancelButtonText: '취소',
    confirmButtonColor: '#ef4444'
  });

  if (result.isConfirmed) {
    try {
      await deleteDoc(doc(db, 'users', userId));
      
      Swal.fire({
        icon: 'success',
        title: '삭제 완료',
        text: '사용자가 삭제되었습니다.',
        timer: 1500,
        showConfirmButton: false
      });

      // 사용자 목록 새로고침
      loadUsers();
      
    } catch (error) {
      console.error('사용자 삭제 오류:', error);
      Swal.fire({
        icon: 'error',
        title: '삭제 실패',
        text: error.message || '사용자를 삭제하는 중 오류가 발생했습니다.'
      });
    }
  }
};

// 사용자 추가 버튼
document.getElementById('addUserBtn').addEventListener('click', async () => {
  const result = await Swal.fire({
    title: '사용자 추가',
    html: `
      <input id="swal-name" class="swal2-input" placeholder="이름" required>
      <input id="swal-affiliation" class="swal2-input" placeholder="소속" required>
    `,
    showCancelButton: true,
    confirmButtonText: '추가',
    cancelButtonText: '취소',
    preConfirm: () => {
      const name = document.getElementById('swal-name').value.trim();
      const affiliation = document.getElementById('swal-affiliation').value.trim();
      
      if (!name || !affiliation) {
        Swal.showValidationMessage('이름과 소속을 모두 입력해주세요.');
        return false;
      }
      
      return { name, affiliation };
    }
  });

  if (result.isConfirmed) {
    try {
      // 5자리 랜덤 코드 생성
      const code = generateRandomCode();
      
      // Firestore에 사용자 추가
      await addDoc(collection(db, 'users'), {
        name: result.value.name,
        affiliation: result.value.affiliation,
        code: code,
        uid: null,
        createdAt: serverTimestamp(),
        linkedAt: null
      });

      Swal.fire({
        icon: 'success',
        title: '사용자 추가 완료',
        html: `
          <p>사용자가 추가되었습니다.</p>
          <p style="margin-top: 1rem; font-weight: 600; font-size: 1.25rem; color: #2563eb;">
            생성된 코드: <span style="font-family: monospace;">${code}</span>
          </p>
          <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280;">
            이 코드를 사용자에게 전달하세요.
          </p>
        `,
        confirmButtonText: '확인'
      });

      // 사용자 목록 새로고침
      loadUsers();
      
    } catch (error) {
      console.error('사용자 추가 오류:', error);
      Swal.fire({
        icon: 'error',
        title: '추가 실패',
        text: error.message || '사용자를 추가하는 중 오류가 발생했습니다.'
      });
    }
  }
});

// 5자리 랜덤 코드 생성
function generateRandomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ==================== 데이터 관리 ====================

// 모든 데이터 불러오기
async function loadAllData() {
  try {
    const listContainer = document.getElementById('dataList');
    listContainer.innerHTML = '<p class="empty-message">데이터를 불러오는 중...</p>';

    const querySnapshot = await getDocs(collection(db, 'probingQuestions'));

    if (querySnapshot.empty) {
      listContainer.innerHTML = '<p class="empty-message">저장된 데이터가 없습니다.</p>';
      updateUserFilter();
      return;
    }

    // 사용자 정보 불러오기
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const usersMap = new Map();
    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      if (userData.uid) {
        usersMap.set(userData.uid, {
          name: userData.name || '',
          affiliation: userData.affiliation || ''
        });
      }
    });

    allData = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const createdAt = data.createdAt?.toDate?.() || new Date();
      
      // 등록된 사용자 정보 가져오기
      const userInfo = usersMap.get(data.uid);
      let displayName = data.displayName || '익명';
      if (userInfo && userInfo.name) {
        displayName = `${userInfo.name}${userInfo.affiliation ? ` (${userInfo.affiliation})` : ''}`;
      }
      
      allData.push({
        id: docSnap.id,
        ...data,
        createdAt: createdAt,
        displayName: displayName
      });
    });

    // 최신순 정렬
    allData.sort((a, b) => b.createdAt - a.createdAt);

    updateUserFilter();
    renderDataList();
    
  } catch (error) {
    console.error('데이터 불러오기 오류:', error);
    document.getElementById('dataList').innerHTML = '<p class="empty-message">데이터를 불러오는 중 오류가 발생했습니다.</p>';
    Swal.fire({
      icon: 'error',
      title: '불러오기 실패',
      text: error.message || '데이터를 불러오는 중 오류가 발생했습니다.'
    });
  }
}

// 사용자 필터 업데이트
function updateUserFilter() {
  const filterSelect = document.getElementById('userFilter');
  const uniqueUsers = [...new Set(allData.map(item => item.displayName || '익명'))];
  
  filterSelect.innerHTML = '<option value="">전체 사용자</option>';
  uniqueUsers.forEach(userName => {
    const option = document.createElement('option');
    option.value = userName;
    option.textContent = userName;
    filterSelect.appendChild(option);
  });
}

// 데이터 목록 렌더링
function renderDataList() {
  const listContainer = document.getElementById('dataList');
  const filterValue = document.getElementById('userFilter').value;
  
  // 필터링
  let filteredData = allData;
  if (filterValue) {
    filteredData = allData.filter(item => (item.displayName || '익명') === filterValue);
  }
  
  if (filteredData.length === 0) {
    listContainer.innerHTML = '<p class="empty-message">표시할 데이터가 없습니다.</p>';
    return;
  }

  const listHTML = filteredData.map((item) => {
    const conversation = item.conversation || [];
    const displayName = item.displayName || '익명';
    const dateStr = item.createdAt.toLocaleString('ko-KR');
    
    // 대화 내용 일부 추출
    let preview = '';
    if (conversation.length > 0) {
      const previewItems = conversation.slice(0, 2);
      preview = previewItems.map(item => `${item.speaker}: ${item.message}`).join(' / ');
      if (conversation.length > 2) {
        preview += ' ...';
      }
    } else {
      preview = '대화 내용 없음';
    }

    return `
      <div class="data-item ${selectedDataId === item.id ? 'active' : ''}" data-id="${item.id}">
        <div class="data-item-header">
          <span class="data-item-name">${displayName}</span>
          <span class="data-item-date">${dateStr}</span>
        </div>
        <div class="data-item-preview">${preview}</div>
      </div>
    `;
  }).join('');

  listContainer.innerHTML = listHTML;

  // 클릭 이벤트 추가
  listContainer.querySelectorAll('.data-item').forEach(item => {
    item.addEventListener('click', () => {
      const itemId = item.getAttribute('data-id');
      selectDataItem(itemId);
    });
  });
}

// 데이터 항목 선택
function selectDataItem(itemId) {
  selectedDataId = itemId;
  const selectedData = allData.find(item => item.id === itemId);
  
  if (!selectedData) {
    return;
  }

  // 목록에서 active 클래스 업데이트
  document.querySelectorAll('.data-item').forEach(item => {
    if (item.getAttribute('data-id') === itemId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // 상세 내용 렌더링
  renderDataDetail(selectedData);
}

// 데이터 상세 내용 렌더링
function renderDataDetail(data) {
  const detailContainer = document.getElementById('dataDetail');
  
  const conversation = data.conversation || [];
  const probingQuestions = data.probingQuestions || [];
  const studentCharacteristics = data.studentCharacteristics || '';
  const displayName = data.displayName || '익명';
  const dateStr = data.createdAt.toLocaleString('ko-KR');

  // 학생 특성 섹션
  let characteristicsHTML = '';
  if (studentCharacteristics.trim()) {
    characteristicsHTML = `
      <div class="student-characteristics-section">
        <h3>👤 가상의 학생 특성</h3>
        <div class="student-characteristics-content">${studentCharacteristics}</div>
      </div>
    `;
  }

  // 대화 테이블
  let conversationHTML = '';
  if (conversation.length > 0) {
    const conversationRows = conversation.map(item => `
      <tr>
        <td class="speaker-cell">${item.speaker}</td>
        <td class="message-cell">${item.message}</td>
      </tr>
    `).join('');

    conversationHTML = `
      <div class="content-section">
        <h3>💬 면접관과 학생의 가상 대화</h3>
        <table class="conversation-table">
          <thead>
            <tr>
              <th>발화자</th>
              <th>대화 내용</th>
            </tr>
          </thead>
          <tbody>
            ${conversationRows}
          </tbody>
        </table>
      </div>
    `;
  } else {
    conversationHTML = `
      <div class="content-section">
        <h3>💬 면접관과 학생의 가상 대화</h3>
        <p style="color: #6b7280; font-size: 0.875rem;">대화 내용이 없습니다.</p>
      </div>
    `;
  }

  // 탐침질문 테이블
  let probingHTML = '';
  if (probingQuestions.length > 0) {
    const probingRows = probingQuestions.map(item => `
      <tr>
        <td class="situation-cell">${item.situation || '-'}</td>
        <td class="question-cell">${item.question || '-'}</td>
      </tr>
    `).join('');

    probingHTML = `
      <div class="content-section">
        <h3>❓ 탐침질문</h3>
        <table class="probing-table">
          <thead>
            <tr>
              <th>상황</th>
              <th>탐침질문</th>
            </tr>
          </thead>
          <tbody>
            ${probingRows}
          </tbody>
        </table>
      </div>
    `;
  } else {
    probingHTML = `
      <div class="content-section">
        <h3>❓ 탐침질문</h3>
        <p style="color: #6b7280; font-size: 0.875rem;">탐침질문이 없습니다.</p>
      </div>
    `;
  }

  // 전체 HTML 조합
  detailContainer.innerHTML = `
    <div class="detail-header">
      <div>
        <h2 style="margin: 0 0 0.5rem 0; font-size: 1.5rem; color: #1f2937;">${displayName}님의 탐침질문</h2>
        <p style="margin: 0; color: #6b7280; font-size: 0.875rem;">작성일: ${dateStr}</p>
      </div>
      <div class="detail-actions">
        <button class="btn btn-danger" onclick="deleteDataItem('${data.id}')">삭제</button>
      </div>
    </div>
    ${characteristicsHTML}
    <div class="content-grid">
      ${conversationHTML}
      ${probingHTML}
    </div>
  `;
}

// 데이터 삭제 함수 (전역으로 등록)
window.deleteDataItem = async function(dataId) {
  const result = await Swal.fire({
    title: '데이터 삭제',
    text: '정말 이 데이터를 삭제하시겠습니까?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '삭제',
    cancelButtonText: '취소',
    confirmButtonColor: '#ef4444'
  });

  if (result.isConfirmed) {
    try {
      await deleteDoc(doc(db, 'probingQuestions', dataId));
      
      Swal.fire({
        icon: 'success',
        title: '삭제 완료',
        text: '데이터가 삭제되었습니다.',
        timer: 1500,
        showConfirmButton: false
      });

      // 데이터 목록 새로고침
      loadAllData();
      
      // 상세 내용 초기화
      document.getElementById('dataDetail').innerHTML = `
        <div class="empty-detail">
          <p>좌측 목록에서 항목을 선택하세요</p>
        </div>
      `;
      
    } catch (error) {
      console.error('데이터 삭제 오류:', error);
      Swal.fire({
        icon: 'error',
        title: '삭제 실패',
        text: error.message || '데이터를 삭제하는 중 오류가 발생했습니다.'
      });
    }
  }
};

// ==================== 메뉴 관리 ====================

// 메뉴 설정 불러오기
async function loadMenuSettings() {
  try {
    const settingsDoc = await getDoc(doc(db, 'menuSettings', 'main'));
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      document.getElementById('mockEval01Toggle').checked = data.mockEval01 !== false;
      document.getElementById('mockEval02Toggle').checked = data.mockEval02 !== false;
      document.getElementById('probing01Toggle').checked = data.probing01 !== false;
      document.getElementById('probing02Toggle').checked = data.probing02 !== false;
      document.getElementById('activity2Toggle').checked = data.activity2 !== false;
    } else {
      // 기본값: 모두 활성화
      document.getElementById('mockEval01Toggle').checked = true;
      document.getElementById('mockEval02Toggle').checked = true;
      document.getElementById('probing01Toggle').checked = true;
      document.getElementById('probing02Toggle').checked = true;
      document.getElementById('activity2Toggle').checked = true;
    }

    // 토글 이벤트 추가
    document.getElementById('mockEval01Toggle').addEventListener('change', async (e) => {
      await saveMenuSettings('mockEval01', e.target.checked);
    });

    document.getElementById('mockEval02Toggle').addEventListener('change', async (e) => {
      await saveMenuSettings('mockEval02', e.target.checked);
    });

    document.getElementById('probing01Toggle').addEventListener('change', async (e) => {
      await saveMenuSettings('probing01', e.target.checked);
    });

    document.getElementById('probing02Toggle').addEventListener('change', async (e) => {
      await saveMenuSettings('probing02', e.target.checked);
    });

    document.getElementById('activity2Toggle').addEventListener('change', async (e) => {
      await saveMenuSettings('activity2', e.target.checked);
    });
    
  } catch (error) {
    console.error('메뉴 설정 불러오기 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '설정 불러오기 실패',
      text: '메뉴 설정을 불러오는 중 오류가 발생했습니다.'
    });
  }
}

// 메뉴 설정 저장
async function saveMenuSettings(key, value) {
  try {
    const settingsDoc = await getDoc(doc(db, 'menuSettings', 'main'));
    const currentData = settingsDoc.exists() ? settingsDoc.data() : {};
    
    await setDoc(doc(db, 'menuSettings', 'main'), {
      ...currentData,
      [key]: value,
      updatedAt: serverTimestamp()
    }, { merge: true });

    Swal.fire({
      icon: 'success',
      title: '설정 저장 완료',
      text: '메뉴 설정이 저장되었습니다.',
      timer: 1500,
      showConfirmButton: false
    });
    
  } catch (error) {
    console.error('메뉴 설정 저장 오류:', error);
    Swal.fire({
      icon: 'error',
      title: '설정 저장 실패',
      text: error.message || '메뉴 설정을 저장하는 중 오류가 발생했습니다.'
    });
    
    // 원래 상태로 되돌리기
    document.getElementById(`${key}Toggle`).checked = !value;
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  
  // 필터 변경 이벤트 등록
  const filterSelect = document.getElementById('userFilter');
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      renderDataList();
    });
  }
});

